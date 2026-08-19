'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { AgentTestConsole } from 'app/nhi-dashboard/components/AgentTestConsole';
import { Lock } from 'lucide-react';
import DashboardPageLayout from 'app/shared/components/DashboardPageLayout';

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
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">
          The Sfinx AAM Agentic Intent Sandbox is restricted strictly to Sfinx Security Administrators.
        </p>
        <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl text-xs text-purple-700 font-mono font-medium">
          Logged in as: {userEmail || 'Unknown User'}
        </div>
      </div>
    </div>
  );
}

export default function NHISimulationPage() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <DashboardPageLayout title="Sfinx AAM Intent Sandbox" subtitle="Loading sandbox runtime...">
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardPageLayout>
    );
  }

  const userRole = (session?.user as { role?: string })?.role;
  const isAuthorized = userRole === 'ADMIN';

  if (!isAuthorized) {
    return (
      <DashboardPageLayout title="Access Restricted" subtitle="Admin privileges required">
        <AccessDeniedView userEmail={session?.user?.email || undefined} />
      </DashboardPageLayout>
    );
  }

  return (
    <DashboardPageLayout
      title="Sfinx AAM Agentic Intent Sandbox"
      subtitle="Simulate and test autonomous AI Screener Agent intent enforcement & JIT token security policies"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <AgentTestConsole />
      </div>
    </DashboardPageLayout>
  );
}
