'use client';

import React from 'react';
import { CandidateInfo } from '../data/mockData';
import { UserCheck, ShieldCheck, Clock, Award } from 'lucide-react';

interface Props {
  candidate: CandidateInfo;
}

/**
 * Header component displaying candidate interview state natively styled in Sfinx Glassmorphism
 */
export const MockCandidateHeader: React.FC<Props> = ({ candidate }) => {
  return (
    <div className="glass-card rounded-squircle p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left Profile Details */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white text-base font-bold shadow-sm">
              AR
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-purple-400 border-2 border-white rounded-full" title="Interview Completed" />
          </div>

          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-lg font-bold text-gray-900">{candidate.name}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                Interview Completed
              </span>
            </div>
            <p className="text-gray-500 text-xs mt-0.5">{candidate.role}</p>
          </div>
        </div>

        {/* Right Info Badges */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-white/60 px-3 py-1.5 rounded-xl border border-gray-200/80 flex items-center gap-2 text-xs text-gray-600 font-medium">
            <Clock className="w-3.5 h-3.5 text-purple-600" />
            <span>Completed: {candidate.completedAt}</span>
          </div>

          <div className="bg-white/60 px-3 py-1.5 rounded-xl border border-gray-200/80 flex items-center gap-2 text-xs text-gray-700 font-medium">
            <Award className="w-3.5 h-3.5 text-purple-600" />
            <span>Target Score: <strong className="text-gray-900 font-bold">90+</strong></span>
          </div>

          <div className="bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-100 flex items-center gap-2 text-xs text-purple-800 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            <span>Sfinx AAM™ Active</span>
          </div>
        </div>

      </div>

      {/* Transcript Preview */}
      <div className="mt-4 pt-3 border-t border-purple-100/40 text-xs text-gray-500 flex items-center gap-2">
        <span className="font-semibold text-gray-700">Transcript Snippet:</span>
        <span className="italic truncate text-gray-600">&quot;{candidate.transcriptSnippet}&quot;</span>
      </div>
    </div>
  );
};
