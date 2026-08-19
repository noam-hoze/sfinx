'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import DashboardPageLayout from 'app/shared/components/DashboardPageLayout';
import { ShieldCheck, ShieldAlert, Lock, Sliders, ToggleLeft, ToggleRight, Clock, Plus } from 'lucide-react';

interface AgentIntentPolicy {
  id: string;
  agentName: string;
  agentType: string;
  allowedIntents: string[];
  restrictedPaths: string[];
  maxTtlMinutes: number;
  isEnforced: boolean;
  description: string;
}

export default function IntentPoliciesPage() {
  const { data: session, status } = useSession();
  const userRole = (session?.user as { role?: string })?.role;
  const isAuthorized = userRole === 'ADMIN';

  const [policies, setPolicies] = useState<AgentIntentPolicy[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newIntentInput, setNewIntentInput] = useState<{ [key: string]: string }>({});

  const fetchPolicies = async () => {
    try {
      const res = await fetch('/api/nhi/policies');
      const data = await res.json();
      if (data.policies) {
        setPolicies(data.policies);
      }
    } catch {
      console.error('Failed to fetch policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchPolicies();
    }
  }, [isAuthorized]);

  const togglePolicyEnforcement = async (policy: AgentIntentPolicy) => {
    setSavingId(policy.id);
    const updatedStatus = !policy.isEnforced;

    try {
      const res = await fetch('/api/nhi/policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: policy.id,
          isEnforced: updatedStatus
        })
      });
      if (res.ok) {
        setPolicies((prev) =>
          prev.map((p) => (p.id === policy.id ? { ...p, isEnforced: updatedStatus } : p))
        );
      }
    } catch {
      console.error('Failed to toggle policy enforcement');
    } finally {
      setSavingId(null);
    }
  };

  const addAllowedIntent = async (policyId: string) => {
    const intentToAdd = newIntentInput[policyId]?.trim();
    if (!intentToAdd) return;

    const targetPolicy = policies.find((p) => p.id === policyId);
    if (!targetPolicy) return;

    if (targetPolicy.allowedIntents.includes(intentToAdd)) {
      setNewIntentInput((prev) => ({ ...prev, [policyId]: '' }));
      return;
    }

    const updatedIntents = [...targetPolicy.allowedIntents, intentToAdd];
    setSavingId(policyId);

    try {
      const res = await fetch('/api/nhi/policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: policyId,
          allowedIntents: updatedIntents
        })
      });
      if (res.ok) {
        setPolicies((prev) =>
          prev.map((p) => (p.id === policyId ? { ...p, allowedIntents: updatedIntents } : p))
        );
        setNewIntentInput((prev) => ({ ...prev, [policyId]: '' }));
      }
    } catch {
      console.error('Failed to add allowed intent');
    } finally {
      setSavingId(null);
    }
  };

  const removeAllowedIntent = async (policyId: string, intentToRemove: string) => {
    const targetPolicy = policies.find((p) => p.id === policyId);
    if (!targetPolicy) return;

    const updatedIntents = targetPolicy.allowedIntents.filter((i) => i !== intentToRemove);
    setSavingId(policyId);

    try {
      const res = await fetch('/api/nhi/policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: policyId,
          allowedIntents: updatedIntents
        })
      });
      if (res.ok) {
        setPolicies((prev) =>
          prev.map((p) => (p.id === policyId ? { ...p, allowedIntents: updatedIntents } : p))
        );
      }
    } catch {
      console.error('Failed to remove allowed intent');
    } finally {
      setSavingId(null);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <DashboardPageLayout title="AAM Intent Policies" subtitle="Loading PostgreSQL security policies...">
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardPageLayout>
    );
  }

  if (!isAuthorized) {
    return (
      <DashboardPageLayout title="Access Restricted" subtitle="Admin privileges required">
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full glass-card rounded-squircle p-8 text-center">
            <Lock className="w-8 h-8 text-purple-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-900">403 Access Denied</h2>
            <p className="text-xs text-gray-500 mt-2">Admin privileges required to view or edit policy rules.</p>
          </div>
        </div>
      </DashboardPageLayout>
    );
  }

  return (
    <DashboardPageLayout
      title="AAM Intent Policies & Governance"
      subtitle="Configure, audit, and enforce autonomous AI agent intent scopes & JIT security policies in PostgreSQL"
    >
      <div className="space-y-6">
        
        {/* Header Overview Card */}
        <div className="glass-card rounded-squircle p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-squircle-sm bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">PostgreSQL Policy Engine Rules</h3>
              <p className="text-xs text-gray-500">
                {policies.length} Active Security Policy Rules stored in database
              </p>
            </div>
          </div>
          <div className="text-xs px-3.5 py-1.5 bg-purple-50 border border-purple-100 text-purple-700 rounded-full font-medium flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-purple-600" /> Active Database Synchronization
          </div>
        </div>

        {/* Policies Grid */}
        <div className="grid grid-cols-1 gap-6">
          {policies.map((policy) => (
            <div key={policy.id} className="glass-card rounded-squircle p-6 space-y-5">
              
              {/* Policy Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-purple-100/50">
                <div>
                  <div className="flex items-center space-x-3">
                    <h4 className="text-base font-bold text-gray-900">{policy.agentName}</h4>
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 bg-purple-50 border border-purple-100 text-purple-700 rounded-md">
                      {policy.agentType}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{policy.description}</p>
                </div>

                {/* Enforcement Toggle Switch */}
                <button
                  onClick={() => togglePolicyEnforcement(policy)}
                  disabled={savingId === policy.id}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                    policy.isEnforced
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm hover:bg-purple-700'
                      : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {policy.isEnforced ? (
                    <>
                      <ToggleRight className="w-4 h-4" /> Policy Enforced
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4 text-gray-400" /> Policy Disabled
                    </>
                  )}
                </button>
              </div>

              {/* Scopes & Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                
                {/* Column 1: Allowed Intent Scopes */}
                <div className="md:col-span-2 space-y-2">
                  <div className="font-semibold text-gray-700 flex items-center justify-between">
                    <span>Authorized Intent Scopes:</span>
                    <span className="text-[10px] text-gray-400 font-mono">Editable in DB</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {policy.allowedIntents.map((intent) => (
                      <span
                        key={intent}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg font-mono text-[11px]"
                      >
                        {intent}
                        <button
                          onClick={() => removeAllowedIntent(policy.id, intent)}
                          className="hover:text-purple-900 text-purple-400 cursor-pointer font-bold"
                          title="Remove scope"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Add Scope Input */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="text"
                      placeholder="Add new intent scope (e.g. telemetry:write)..."
                      value={newIntentInput[policy.id] || ''}
                      onChange={(e) => setNewIntentInput({ ...newIntentInput, [policy.id]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addAllowedIntent(policy.id);
                      }}
                      className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono text-gray-800 focus:outline-none focus:border-purple-500 flex-1"
                    />
                    <button
                      onClick={() => addAllowedIntent(policy.id)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>

                {/* Column 2: TTL & Restricted Endpoints */}
                <div className="space-y-3 p-3.5 bg-purple-50/40 border border-purple-100/80 rounded-xl">
                  <div>
                    <div className="text-[11px] font-semibold text-gray-700 flex items-center gap-1 mb-1">
                      <Clock className="w-3.5 h-3.5 text-purple-600" /> Max JIT Token TTL
                    </div>
                    <div className="font-mono font-bold text-purple-900 text-xs">
                      {policy.maxTtlMinutes} minutes
                    </div>
                  </div>

                  <div className="pt-2 border-t border-purple-100/80">
                    <div className="text-[11px] font-semibold text-gray-700 flex items-center gap-1 mb-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-purple-600" /> Restricted Paths
                    </div>
                    <div className="space-y-1">
                      {policy.restrictedPaths.map((path) => (
                        <div key={path} className="font-mono text-[10px] text-gray-600 bg-white px-2 py-0.5 rounded border border-purple-100">
                          {path}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ))}
        </div>

      </div>
    </DashboardPageLayout>
  );
}
