"use client";

import { SfinxSpinner } from "app/shared/components";

export default function SpinnerTestPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-24" style={{ background: "var(--page-bg)" }}>
      <SfinxSpinner
        size="lg"
        title="Analyzing Candidates"
        messages={["Scanning resumes...", "Ranking by fit...", "Almost there..."]}
      />
    </div>
  );
}
