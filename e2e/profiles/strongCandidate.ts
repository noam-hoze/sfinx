/**
 * Strong candidate profile: gives detailed, technical answers and uses external tools.
 * Expects high scores, evidence clips, and full summary generation.
 */
import type { CandidateProfile } from "./types";

export const strongCandidate: CandidateProfile = {
  name: "strong-candidate",
  backgroundAnswers: [
    "In my last role at a robotics company, I designed the real-time firmware scheduler for a 6-axis robotic arm using FreeRTOS. The main challenge was meeting 1ms control loop deadlines while handling CAN bus interrupts. I solved it by implementing a priority-based preemptive scheduler with dedicated ISR handlers that reduced jitter to under 50 microseconds.",
    "I built a CI/CD pipeline using GitHub Actions and Docker that reduced deployment time from 2 hours to 15 minutes. I also wrote comprehensive unit tests achieving 90% coverage on the embedded HAL layer using a hardware-in-the-loop simulator I designed from scratch.",
    "For the memory management challenge, I implemented a custom pool allocator to avoid heap fragmentation on our 512KB RAM microcontroller. I profiled using Valgrind on the host build and Segger SystemView on target, which helped identify a 30% reduction in peak memory usage.",
  ],
  expectContributions: true,
  expectEvidenceClips: true,
  expectSummaryContent: true,
  expectPositiveScore: true,
  codeToType: [
    "function fibonacci(n: number): number {",
    "  if (n <= 1) return n;",
    "  return fibonacci(n - 1) + fibonacci(n - 2);",
    "}",
  ].join("\n"),
  codeToPaste: [
    "const memo = new Map<number, number>();",
    "function fibMemo(n: number): number {",
    "  if (memo.has(n)) return memo.get(n)!;",
    "  if (n <= 1) return n;",
    "  const result = fibMemo(n - 1) + fibMemo(n - 2);",
    "  memo.set(n, result);",
    "  return result;",
    "}",
  ].join("\n"),
  expectExternalToolUsage: false, // ARCH-002: ExternalToolUsage not persisted on single paste
  expectCodingContributions: true,
};
