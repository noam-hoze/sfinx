/** Background session guard helpers and constants. */

export const TIMEBOX_MS = 4 * 60 * 1000; // 4:00
export const ZERO_RUN_LIMIT = 2;
export const PROJECT_CAP = 2;

export type GuardReason = "timebox" | "projects_cap" | "gate";

export interface GuardState {
  startedAtMs?: number;
  zeroRuns: number;
  projectsUsed: number;
}

export function nowMs(): number {
  return Date.now();
}

export function ensureTimerStarted(gs: GuardState, clockMs = nowMs()): GuardState {
  if (gs.startedAtMs) return gs;
  return { ...gs, startedAtMs: clockMs };
}

export function elapsedMs(gs: GuardState, clockMs = nowMs()): number {
  if (!gs.startedAtMs) return 0;
  return Math.max(0, clockMs - gs.startedAtMs);
}

export function formatCountdown(remainingMs: number): string {
  const clamped = Math.max(0, Math.floor(remainingMs / 1000));
  const m = Math.floor(clamped / 60)
    .toString()
    .padStart(1, "0");
  const s = (clamped % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function incZeroRuns(consecutive: number, isZeroTriplet: boolean): number {
  return isZeroTriplet ? consecutive + 1 : 0;
}

export function shouldTransition(
  gs: GuardState,
  opts: { gateReady: boolean; clockMs?: number }
): GuardReason | null {
  const tMs = elapsedMs(gs, opts.clockMs);
  if (tMs >= TIMEBOX_MS) return "timebox";
  if (gs.projectsUsed >= PROJECT_CAP) return "projects_cap";
  if (opts.gateReady) return "gate";
  return null;
}


