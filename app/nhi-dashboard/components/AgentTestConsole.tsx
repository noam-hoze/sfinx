'use client';

import React, { useState, useEffect } from 'react';
import { Play, ShieldAlert, CheckCircle2, XCircle, Terminal, Key, Cpu, Sparkles } from 'lucide-react';

interface AuditLog {
  timestamp: string;
  event: string;
  detail: string;
}

interface TestResult {
  success: boolean;
  status: number;
  action: 'APPROVED' | 'BLOCKED';
  intent?: string;
  tokenId?: string;
  expiresAt?: string;
  ttlMinutes?: number;
  evaluationResult?: {
    score: number;
    decision: string;
    keyStrengths: string[];
    summary: string;
  };
  auditTrail: AuditLog[];
}

/**
 * Agent Test Console component for executing AAM intent tests in Sfinx Glassmorphism
 */
export const AgentTestConsole: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [countdown, setCountdown] = useState<number>(900);

  useEffect(() => {
    if (!result?.expiresAt) return;
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [result]);

  const runTest = async (testType: 'VALID_EVALUATION' | 'ROGUE_ATTACK') => {
    setLoading(true);
    setResult(null);
    setCountdown(900);

    try {
      const res = await fetch('/api/nhi/agent-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType, candidateId: 'cand-88392' })
      });
      const data: TestResult = await res.json();
      setResult(data);
    } catch {
      console.error('Failed to run agent test');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="glass-card rounded-squircle p-6 mb-6">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-purple-100/40">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-squircle-sm bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              Agentic Access Management (AAM™) Intent Sandbox
            </h3>
            <p className="text-xs text-gray-500">
              Test autonomous AI Screener Agent intent policy enforcement & dynamic JIT tokens
            </p>
          </div>
        </div>
        <span className="text-xs px-3 py-1 bg-purple-50 border border-purple-100 text-purple-700 rounded-full font-medium flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Intent Engine Active
        </span>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <button
          onClick={() => runTest('VALID_EVALUATION')}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-medium text-sm transition-all shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-white" />
          Test 1: Run Valid Agent Evaluation
        </button>

        <button
          onClick={() => runTest('ROGUE_ATTACK')}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 font-medium text-sm transition-all shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <ShieldAlert className="w-4 h-4 text-purple-600" />
          Test 2: Simulate Rogue Agent Attack
        </button>
      </div>

      {/* Dynamic JIT Token Inspector */}
      {result?.tokenId && (
        <div className="mb-5 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 text-white">
          <div className="flex items-center space-x-3">
            <Key className="w-5 h-5 text-purple-400 animate-pulse" />
            <div>
              <div className="text-[10px] text-purple-300 font-mono font-semibold uppercase tracking-wider">
                Ephemeral JIT Token Issued
              </div>
              <div className="text-sm font-mono text-white font-bold">{result.tokenId}</div>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <div className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-slate-400">Scoped Intent: </span>
              <span className="text-purple-300 font-mono font-semibold">{result.intent}</span>
            </div>
            <div className="bg-purple-950/80 px-3 py-1.5 rounded-lg border border-purple-800 text-purple-200 font-mono font-bold">
              TTL: {formatTime(countdown)}
            </div>
          </div>
        </div>
      )}

      {/* Embedded Terminal Log Stream */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs overflow-hidden shadow-inner text-slate-200">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800 text-slate-400">
          <span className="flex items-center gap-1.5"><Terminal className="w-4 h-4 text-purple-400" /> Live Audit Trail Stream</span>
          {result && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${result.action === 'APPROVED' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
              STATUS {result.status}: {result.action}
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500 animate-pulse">
            Evaluating Sfinx Intent Policy...
          </div>
        ) : !result ? (
          <div className="py-6 text-center text-slate-500">
            Click one of the test buttons above to trigger live agent intent evaluation.
          </div>
        ) : (
          <div className="space-y-2">
            {result.auditTrail.map((log, idx) => (
              <div key={idx} className="flex items-start space-x-3 leading-relaxed">
                <span className="text-slate-500 select-none">[{log.timestamp.split('T')[1].split('.')[0]}]</span>
                {result.action === 'APPROVED' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className={`font-semibold ${log.event.includes('VIOLATION') || log.event.includes('INTERCEPTED') ? 'text-slate-300' : 'text-purple-300'}`}>
                    {log.event}:
                  </span>{' '}
                  <span className="text-slate-300">{log.detail}</span>
                </div>
              </div>
            ))}

            {result.evaluationResult && (
              <div className="mt-4 pt-3 border-t border-slate-800 bg-purple-950/30 p-3 rounded-lg border border-purple-900/40">
                <div className="text-purple-300 font-semibold mb-1">
                  🤖 Agent Output: Score {result.evaluationResult.score}/100 ({result.evaluationResult.decision})
                </div>
                <div className="text-slate-400 text-[11px]">
                  {result.evaluationResult.summary}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
