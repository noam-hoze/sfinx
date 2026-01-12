/** Background session guard helpers and constants. */

export const TIMEBOX_MS = 7 * 1000; // 4:00 default fallback; overridden per interview

export type GuardReason = "timebox" | "all_topics_complete";

export interface GuardState {
  startedAtMs?: number;
  timeboxMs?: number;
}

export interface CategoryConfidence {
  name: string;
  confidence: number;
  avgStrength: number;
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

export function shouldTransition(
  gs: GuardState,
  opts: { clockMs?: number; timeboxMs?: number; categories?: CategoryConfidence[] }
): GuardReason | null {
  // Check if all categories reached avgStrength of 100
  if (opts.categories && opts.categories.length > 0) {
    const allComplete = opts.categories.every(cat => cat.avgStrength >= 100);
    if (allComplete) return "all_topics_complete";
  }

  // Check timebox
  const tMs = elapsedMs(gs, opts.clockMs);
  const limit =
    typeof gs.timeboxMs === "number" && Number.isFinite(gs.timeboxMs) && gs.timeboxMs > 0
      ? gs.timeboxMs
      : typeof opts.timeboxMs === "number" && Number.isFinite(opts.timeboxMs) && opts.timeboxMs > 0
      ? opts.timeboxMs
      : TIMEBOX_MS;
  if (tMs >= limit) return "timebox";
  return null;
}


