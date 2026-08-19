'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Play, CheckCircle2, XCircle, Terminal, Key, Cpu, Sparkles, ShieldCheck, ShieldAlert, RotateCcw, Clock, AlertOctagon, ChevronDown, ChevronUp } from 'lucide-react';
import { NHIInventoryGrid } from './NHIInventoryGrid';
import { INITIAL_IDENTITIES, MachineIdentity } from '../data/mockData';

interface AuditLog {
  timestamp: string;
  event: string;
  detail: string;
}

interface TestResult {
  success: boolean;
  status: number;
  action: 'APPROVED' | 'BLOCKED' | 'EXPIRED';
  intent?: string;
  tokenId?: string;
  expiresAt?: string;
  ttlMinutes?: number;
  ttlSeconds?: number;
  evaluationResult?: {
    score: number;
    decision: string;
    keyStrengths: string[];
    summary: string;
  };
  auditTrail: AuditLog[];
}

/**
 * Agent Test Console component with 60s Live Backward Countdown & Automatic Background Revocation Process
 */
export const AgentTestConsole: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [countdown, setCountdown] = useState<number>(60);
  const [isRevoked, setIsRevoked] = useState<boolean>(false);
  const [identities, setIdentities] = useState<MachineIdentity[]>(INITIAL_IDENTITIES);

  // Accordion state for unfoldable scenario step descriptions (unfolded by default, persisted in localStorage)
  const [test1Open, setTest1Open] = useState<boolean>(true);
  const [test2Open, setTest2Open] = useState<boolean>(true);

  // Hydrate saved accordion states from localStorage on mount
  useEffect(() => {
    const savedTest1 = localStorage.getItem('sandbox_test1_open');
    if (savedTest1 !== null) {
      setTest1Open(JSON.parse(savedTest1));
    }
    const savedTest2 = localStorage.getItem('sandbox_test2_open');
    if (savedTest2 !== null) {
      setTest2Open(JSON.parse(savedTest2));
    }
  }, []);

  const toggleTest1 = () => {
    setTest1Open((prev) => {
      const next = !prev;
      localStorage.setItem('sandbox_test1_open', JSON.stringify(next));
      return next;
    });
  };

  const toggleTest2 = () => {
    setTest2Open((prev) => {
      const next = !prev;
      localStorage.setItem('sandbox_test2_open', JSON.stringify(next));
      return next;
    });
  };

  const fetchIdentities = useCallback(() => {
    fetch('/api/nhi/identities')
      .then((res) => res.json())
      .then((data) => {
        if (data.identities) {
          setIdentities(data.identities);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchIdentities();
  }, [fetchIdentities]);

  // Live 1-second interval ticking backwards from 60s to 0s
  useEffect(() => {
    if (!result?.expiresAt || isRevoked) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsRevoked(true);

          // Execute REAL OpenAI deletion and update PostgreSQL
          fetch('/api/nhi/revoke-key', { method: 'POST' })
            .then((res) => res.json())
            .then((revokeData) => {
              if (revokeData.identities) {
                setIdentities(revokeData.identities);
              }
            })
            .catch(() => {});

          // Append automatic background revocation event to terminal audit trail
          setResult((prevResult) => {
            if (!prevResult) return null;
            const nowIso = new Date().toISOString();
            return {
              ...prevResult,
              action: 'EXPIRED',
              status: 401,
              auditTrail: [
                ...prevResult.auditTrail,
                { timestamp: nowIso, event: 'TTL_EXPIRED', detail: `60s Ephemeral JIT Token ${prevResult.tokenId} reached 00:00 limit` },
                { timestamp: nowIso, event: 'AUTOMATIC_REVOCATION', detail: 'Sfinx Background Process deleted key on OpenAI platform & purged credentials' },
                { timestamp: nowIso, event: 'SECURITY_CONTAINED', detail: 'Token status: HTTP 401 Unauthorized (Credential Invalidation Verified)' }
              ]
            };
          });

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [result, isRevoked]);

  const runTest = async (testType: 'VALID_EVALUATION' | 'ROGUE_ATTACK') => {
    setLoading(true);
    setResult(null);
    setIsRevoked(false);
    setCountdown(60);

    try {
      const res = await fetch('/api/nhi/agent-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType, candidateId: 'cand-88392' })
      });
      const data: TestResult & { identities?: MachineIdentity[] } = await res.json();
      setResult(data);
      if (data.identities) {
        setIdentities(data.identities);
      } else {
        fetchIdentities();
      }
    } catch {
      console.error('Failed to run agent test');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDemoState = async () => {
    try {
      const res = await fetch('/api/nhi/reset-demo', { method: 'POST' });
      const data = await res.json();
      if (data.identities) {
        setIdentities(data.identities);
      } else {
        fetchIdentities();
      }
      setResult(null);
      setIsRevoked(false);
      setCountdown(60);
    } catch {
      console.error('Failed to reset demo state');
    }
  };

  const formatClock = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6">

      {/* Main 1/4 (Left) and 3/4 (Right) Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left Column (1/4 Width ~ 25%): Test Control Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-card rounded-squircle p-5 space-y-5">
            
            {/* Header Icon & Title */}
            <div className="flex items-center space-x-3 pb-3 border-b border-purple-100/40">
              <div className="w-9 h-9 rounded-squircle-sm bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 leading-tight">
                  Intent Test Suite
                </h3>
                <p className="text-[11px] text-gray-500">
                  Trigger policy scenarios
                </p>
              </div>
            </div>

            {/* Test 1 Section */}
            <div className="space-y-2.5">
              <button
                onClick={() => runTest('VALID_EVALUATION')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white shrink-0" />
                <span>Test 1: Run Valid Agent Evaluation</span>
              </button>

              {/* Unfoldable Step Description Accordion for Test 1 */}
              <div className="bg-purple-50/60 rounded-xl border border-purple-100/80 overflow-hidden text-[11px] text-gray-600 transition-all">
                <button
                  type="button"
                  onClick={toggleTest1}
                  className="w-full font-bold text-purple-900 flex items-center justify-between p-3 text-xs hover:bg-purple-100/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>Valid Agent Flow</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-normal text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded font-mono">3 steps</span>
                    {test1Open ? <ChevronUp className="w-3.5 h-3.5 text-purple-600" /> : <ChevronDown className="w-3.5 h-3.5 text-purple-600" />}
                  </div>
                </button>

                {test1Open && (
                  <div className="px-3 pb-3 space-y-1.5 pt-1 border-t border-purple-100/60 animate-fadeIn">
                    <div className="flex items-start gap-1.5 text-gray-700">
                      <span className="font-mono font-bold text-purple-600 shrink-0">1.</span>
                      <span>Agent requests JIT token for candidate screening.</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-gray-700">
                      <span className="font-mono font-bold text-purple-600 shrink-0">2.</span>
                      <span>Policy Engine validates intent scopes <code className="text-purple-700 bg-purple-100/80 px-1 py-0.5 rounded font-mono text-[10px]">[candidates:read, evaluations:write]</code>.</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-gray-700">
                      <span className="font-mono font-bold text-purple-600 shrink-0">3.</span>
                      <span>Issues 60s JIT token (live ticking clock in table), rotates OpenAI key & auto-deletes key at 00:00!</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Test 2 Section */}
            <div className="space-y-2.5 pt-3 border-t border-purple-100/40">
              <button
                onClick={() => runTest('ROGUE_ATTACK')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white shrink-0" />
                <span>Test 2: Simulate Rogue Agent Attack</span>
              </button>

              {/* Unfoldable Step Description Accordion for Test 2 */}
              <div className="bg-purple-50/60 rounded-xl border border-purple-100/80 overflow-hidden text-[11px] text-gray-600 transition-all">
                <button
                  type="button"
                  onClick={toggleTest2}
                  className="w-full font-bold text-purple-900 flex items-center justify-between p-3 text-xs hover:bg-purple-100/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>Rogue Attack Flow</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-normal text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded font-mono">3 steps</span>
                    {test2Open ? <ChevronUp className="w-3.5 h-3.5 text-purple-600" /> : <ChevronDown className="w-3.5 h-3.5 text-purple-600" />}
                  </div>
                </button>

                {test2Open && (
                  <div className="px-3 pb-3 space-y-1.5 pt-1 border-t border-purple-100/60 animate-fadeIn">
                    <div className="flex items-start gap-1.5 text-gray-700">
                      <span className="font-mono font-bold text-purple-600 shrink-0">1.</span>
                      <span>Compromised agent calls <code className="text-purple-900 bg-purple-100 px-1 py-0.5 rounded font-mono text-[10px]">/api/admin/system-secrets</code>.</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-gray-700">
                      <span className="font-mono font-bold text-purple-600 shrink-0">2.</span>
                      <span>Policy Engine intercepts request & detects scope violation.</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-gray-700">
                      <span className="font-mono font-bold text-purple-600 shrink-0">3.</span>
                      <span>Blocks call, revokes credentials & logs threat alert.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Policy Engine Note */}
            <div className="pt-2 border-t border-purple-100/40 flex items-center gap-1.5 text-[10px] text-purple-700 font-semibold">
              <Sparkles className="w-3 h-3 text-purple-500 shrink-0" /> Real-Time PostgreSQL Intent Enforcement
            </div>

          </div>
        </div>

        {/* Right Column (3/4 Width ~ 75%): Stream Debug Panel & JIT Token Inspector */}
        <div className="lg:col-span-3 space-y-4">

          {/* Dynamic JIT Token Inspector with Live Backward Countdown & Revocation Banner */}
          {result?.tokenId && (
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 text-white transition-all ${isRevoked ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-800'}`}>
              <div className="flex items-center space-x-3">
                {isRevoked ? (
                  <AlertOctagon className="w-5 h-5 text-slate-400 shrink-0" />
                ) : (
                  <Key className="w-5 h-5 text-purple-400 animate-pulse shrink-0" />
                )}
                <div>
                  <div className="text-[10px] text-purple-300 font-mono font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <span>Ephemeral JIT Token</span>
                    {isRevoked && <span className="text-slate-400 font-bold">(EXPIRED & DELETED ON OPENAI)</span>}
                  </div>
                  <div className={`text-sm font-mono font-bold ${isRevoked ? 'text-slate-400 line-through' : 'text-white'}`}>
                    {result.tokenId}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-xs">
                <div className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                  <span className="text-slate-400">Scoped Intent: </span>
                  <span className="text-purple-300 font-mono font-semibold">{result.intent}</span>
                </div>

                {/* Backward Countdown Clock Badge */}
                {isRevoked ? (
                  <div className="bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 font-mono font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>REVOKED & PURGED (00:00)</span>
                  </div>
                ) : (
                  <div className="bg-purple-950/90 px-3 py-1.5 rounded-lg border border-purple-800 text-purple-200 font-mono font-bold flex items-center gap-1.5 shadow-sm">
                    <Clock className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                    <span>TTL: {formatClock(countdown)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Embedded Terminal Audit Log Stream */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 font-mono text-xs overflow-hidden shadow-inner text-slate-200 min-h-[380px] flex flex-col">
            
            {/* Terminal Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800 text-slate-400">
              <span className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" /> Live Audit Trail Stream
              </span>
              {result && (
                <span className={`px-2.5 py-1 rounded text-[10px] font-bold ${isRevoked ? 'bg-slate-800 text-slate-300 border border-slate-700' : result.action === 'APPROVED' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                  STATUS {result.status}: {isRevoked ? 'REVOKED & PURGED' : result.action}
                </span>
              )}
            </div>

            {/* Terminal Content Area */}
            <div className="flex-1 flex flex-col justify-center">
              {loading ? (
                <div className="py-12 text-center text-slate-500 animate-pulse">
                  Evaluating Policy & Executing Autonomous OpenAI Rotation...
                </div>
              ) : !result ? (
                <div className="py-12 text-center text-slate-500 leading-relaxed">
                  Click one of the test scenario buttons on the left to trigger live agent intent evaluation & autonomous remediation.
                </div>
              ) : (
                <div className="space-y-3 justify-start">
                  {result.auditTrail.map((log, idx) => (
                    <div key={idx} className="flex items-start space-x-3 leading-relaxed animate-fadeIn">
                      <span className="text-slate-500 select-none shrink-0">[{log.timestamp.split('T')[1].split('.')[0]}]</span>
                      {log.event.includes('EXPIRED') || log.event.includes('REVOCATION') || log.event.includes('VIOLATION') ? (
                        <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className={`font-semibold ${log.event.includes('EXPIRED') || log.event.includes('REVOCATION') ? 'text-purple-300 font-bold' : log.event.includes('VIOLATION') ? 'text-slate-300' : 'text-purple-300'}`}>
                          {log.event}:
                        </span>{' '}
                        <span className="text-slate-300">{log.detail}</span>
                      </div>
                    </div>
                  ))}

                  {result.evaluationResult && !isRevoked && (
                    <div className="mt-4 pt-3 border-t border-slate-800 bg-purple-950/30 p-3.5 rounded-lg border border-purple-900/40">
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

          {/* Embedded Real-Time NHI Inventory & Governance Table with Live Ticking Clock inside KEY AGE Column */}
          <div className="pt-4">
            <div className="text-sm font-bold text-gray-900 mb-3 flex items-center justify-between">
              <span>Live NHI Governance Posture Table</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleResetDemoState}
                  className="text-xs px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="Reset PostgreSQL state back to initial 142-day vulnerable state"
                >
                  <RotateCcw className="w-3 h-3 text-purple-600" />
                  Reset Demo State
                </button>
                <span className="text-xs font-normal text-purple-600 font-mono">Updates live on test execution</span>
              </div>
            </div>
            <NHIInventoryGrid identities={identities} activeCountdown={countdown} isRevoked={isRevoked} />
          </div>

        </div>

      </div>

    </div>
  );
};
