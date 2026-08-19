'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { MOCK_CANDIDATE, INITIAL_IDENTITIES } from './data/mockData';
import { MockCandidateHeader } from './components/MockCandidateHeader';
import { AgentTestConsole } from './components/AgentTestConsole';
import { NHIInventoryGrid } from './components/NHIInventoryGrid';
import { ShieldCheck, ShieldAlert, Cpu, Lock, AlertOctagon } from 'lucide-react';
import DashboardPageLayout from 'app/shared/components/DashboardPageLayout';

/**
 * Top Stat Cards styled natively in Sfinx Glassmorphism & Purple Brand design
 */
function TopStatCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div className="glass-card rounded-squircle p-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500 font-medium">Total Machine Identities</div>
          <div className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">12 Active</div>
        </div>
        <div className="w-10 h-10 rounded-squircle-sm bg-purple-50 border border-purple-100/80 flex items-center justify-center text-purple-600">
          <Cpu className="w-5 h-5" />
        </div>
      </div>

      <div className="glass-card rounded-squircle p-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500 font-medium">NHI Posture Risk Score</div>
          <div className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">68 / 100</div>
        </div>
        <div className="w-10 h-10 rounded-squircle-sm bg-purple-50 border border-purple-100/80 flex items-center justify-center text-purple-600">
          <ShieldAlert className="w-5 h-5" />
        </div>
      </div>

      <div className="glass-card rounded-squircle p-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500 font-medium">Sfinx AAM™ Protection</div>
          <div className="text-2xl font-bold text-purple-600 mt-1 tracking-tight">Active</div>
        </div>
        <div className="w-10 h-10 rounded-squircle-sm bg-purple-50 border border-purple-100/80 flex items-center justify-center text-purple-600">
          <ShieldCheck className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

/**
 * Access Denied Security Screen Component
 */
function AccessDeniedView({ userEmail }: { userEmail?: string }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full glass-card rounded-squircle p-8 text-center">
        <div className="w-12 h-12 bg-purple-50 text-purple-600 border border-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">403 Access Denied</h2>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          The Sfinx Security & NHI Admin Control Plane is restricted exclusively to authorized administrators.
        </p>
        <div className="mt-4 p-3 bg-purple-50/50 rounded-xl border border-purple-100 text-xs font-mono text-gray-700">
          Current User: <span className="font-bold text-gray-900">{userEmail || 'Unauthenticated Guest'}</span>
        </div>
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-purple-700 font-medium">
          <AlertOctagon className="w-3.5 h-3.5" /> Admin Role Required (UserRole.ADMIN)
        </div>
      </div>
    </div>
  );
}

/**
 * Main Sfinx NHI & Agentic Access Management Admin Dashboard Page
 */
export default function NHIDashboardPage() {
  const { data: session, status } = useSession();
  const userEmail = session?.user?.email || undefined;
  const userRole = (session?.user as { role?: string })?.role;
  const isAuthorized = userRole === 'ADMIN';

  if (status === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-500 font-medium">
        Authenticating Sfinx Admin session...
      </div>
    );
  }

  if (!isAuthorized) {
    return <AccessDeniedView userEmail={userEmail} />;
  }

  return (
    <DashboardPageLayout
      title="Security & Non-Human Identities"
      subtitle="Machine identity governance, zero-downtime secret rotation, and agent intent control"
      action={
        <div className="text-xs px-3.5 py-2 glass-card rounded-xl font-medium text-gray-600 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Authenticated Admin: <strong className="text-gray-900">{userEmail}</strong>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Stat Cards */}
        <TopStatCards />

        {/* Candidate Context Header */}
        <MockCandidateHeader candidate={MOCK_CANDIDATE} />

        {/* Agentic Access Management Sandbox */}
        <AgentTestConsole />

        {/* Non-Human Identity Inventory Grid */}
        <NHIInventoryGrid identities={INITIAL_IDENTITIES} />
      </div>
    </DashboardPageLayout>
  );
}
