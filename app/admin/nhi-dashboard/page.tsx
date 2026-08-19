'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { INITIAL_IDENTITIES, MachineIdentity } from 'app/nhi-dashboard/data/mockData';
import { NHIInventoryGrid } from 'app/nhi-dashboard/components/NHIInventoryGrid';
import { ShieldAlert, Cpu, Lock, AlertOctagon, Info } from 'lucide-react';
import DashboardPageLayout from 'app/shared/components/DashboardPageLayout';

/**
 * Top Stat Cards calculated dynamically based on real Machine Identities inventory & strike rules in PostgreSQL
 */
function TopStatCards({ identities }: { identities: MachineIdentity[] }) {
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const totalCount = identities.length;

  // Calculate Strikes per identity from PostgreSQL metadata
  let totalStrikes = 0;
  identities.forEach((i) => {
    if (i.keyAgeDays > 90) totalStrikes += 1; // Age Strike
    if (i.owner.toLowerCase() === 'unassigned') totalStrikes += 1; // Owner Strike
    if (i.isOverPrivileged) totalStrikes += 1; // Scope Strike
  });

  // Posture Score formula: 100 - (Total Risk Strikes * 5)
  const postureScore = Math.max(0, Math.min(100, 100 - totalStrikes * 5));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 relative z-30">
      
      {/* Total Machine Identities */}
      <div className="glass-card rounded-squircle p-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500 font-medium">Total Machine Identities</div>
          <div className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">{totalCount} Active</div>
        </div>
        <div className="w-10 h-10 rounded-squircle-sm bg-purple-50 border border-purple-100/80 flex items-center justify-center text-purple-600">
          <Cpu className="w-5 h-5" />
        </div>
      </div>

      {/* NHI Posture Risk Score with Interactive Light Glassmorphism Tooltip */}
      <div className="glass-card rounded-squircle p-5 flex items-center justify-between relative z-30">
        <div>
          <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
            <span>NHI Posture Risk Score</span>
            
            {/* Tooltip Icon */}
            <div className="relative inline-block">
              <button
                type="button"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => setShowTooltip((prev) => !prev)}
                className="text-gray-400 hover:text-purple-600 focus:outline-none cursor-pointer"
                title="View Scoring Rules"
              >
                <Info className="w-3.5 h-3.5" />
              </button>

              {/* Light Glassmorphism Tooltip Popup (High Z-Index, No Dark Theme) */}
              {showTooltip && (
                <div className="absolute left-0 top-6 z-50 w-64 p-3.5 bg-white/95 backdrop-blur-md text-gray-800 rounded-xl shadow-xl shadow-purple-500/10 text-xs space-y-2 border border-purple-200 animate-fadeIn">
                  <div className="font-bold text-purple-900 border-b border-purple-100 pb-1.5 flex justify-between items-center">
                    <span>Strike-Based Risk Scoring</span>
                    <span className="text-purple-700 font-mono text-[10px] font-semibold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">-5 pts / strike</span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-gray-600">
                    <div className="flex justify-between items-center">
                      <span>⏰ Stale Age (&gt;90 days):</span>
                      <span className="font-mono text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded font-semibold text-[10px]">Strike 1</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>👤 Orphan (Unassigned):</span>
                      <span className="font-mono text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded font-semibold text-[10px]">Strike 2</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>🔓 Scope (Wildcard *):</span>
                      <span className="font-mono text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded font-semibold text-[10px]">Strike 3</span>
                    </div>
                  </div>
                  <div className="pt-1.5 border-t border-purple-100 text-[10px] text-gray-500 flex justify-between items-center">
                    <span>Current DB Total:</span>
                    <strong className="text-purple-900 font-bold">{totalStrikes} Strikes ({totalStrikes * 5} pts deducted)</strong>
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">
            {postureScore} / 100
          </div>
        </div>

        <div className="w-10 h-10 rounded-squircle-sm bg-purple-50 border border-purple-100/80 flex items-center justify-center text-purple-600">
          <ShieldAlert className="w-5 h-5" />
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
 * Main Sfinx Security & Non-Human Identities Admin Dashboard Page (/admin/nhi-dashboard)
 */
export default function NHIDashboardPage() {
  const { data: session, status } = useSession();
  const userEmail = session?.user?.email || undefined;
  const userRole = (session?.user as { role?: string })?.role;
  const isAuthorized = userRole === 'ADMIN';

  const [identities, setIdentities] = useState<MachineIdentity[]>(INITIAL_IDENTITIES);

  useEffect(() => {
    fetch('/api/nhi/identities')
      .then((res) => res.json())
      .then((data) => {
        if (data.identities) {
          setIdentities(data.identities);
        }
      })
      .catch(() => {});
  }, []);

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
      subtitle="Machine identity governance, zero-downtime secret rotation, and posture risk score control"
    >
      <div className="space-y-6">
        {/* Dynamic Stat Cards with Z-Index fix */}
        <TopStatCards identities={identities} />

        {/* Non-Human Identity Inventory Grid */}
        <NHIInventoryGrid identities={identities} />
      </div>
    </DashboardPageLayout>
  );
}
