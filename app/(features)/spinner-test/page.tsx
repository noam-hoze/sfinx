"use client";

import SfinxSpinner from "../interview/components/backgroundInterview/SfinxSpinner";

export default function SpinnerTestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-12">
        <h1 className="text-3xl font-bold text-gray-900">Spinner Test</h1>
        
        <div className="flex gap-12 items-center">
          <div className="flex flex-col items-center gap-4">
            <SfinxSpinner size="sm" />
            <p className="text-sm text-gray-600">Small</p>
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <SfinxSpinner size="md" />
            <p className="text-sm text-gray-600">Medium</p>
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <SfinxSpinner size="lg" />
            <p className="text-sm text-gray-600">Large</p>
          </div>
        </div>
      </div>
    </div>
  );
}

