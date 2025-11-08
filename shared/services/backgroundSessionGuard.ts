/** Background session guard helpers and constants. */

export const TIMEBOX_MS = 7 * 1000; // 4:00 default fallback; overridden per interview
export const CONSECUTIVE_USELESS_LIMIT = 2;

export type GuardReason = "timebox" | "useless_answers" | "gate";

export interface GuardState {
  startedAtMs?: number;
  consecutiveUselessAnswers: number;
  timeboxMs?: number;
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

export function incConsecutiveUseless(consecutive: number, isZeroTriplet: boolean): number {
  return isZeroTriplet ? consecutive + 1 : 0;
}

export function shouldTransition(
  gs: GuardState,
  opts: { gateReady: boolean; clockMs?: number; timeboxMs?: number }
): GuardReason | null {
  const tMs = elapsedMs(gs, opts.clockMs);
  const limit =
    typeof gs.timeboxMs === "number" && Number.isFinite(gs.timeboxMs) && gs.timeboxMs > 0
      ? gs.timeboxMs
      : typeof opts.timeboxMs === "number" && Number.isFinite(opts.timeboxMs) && opts.timeboxMs > 0
      ? opts.timeboxMs
      : TIMEBOX_MS;
  if (tMs >= limit) return "timebox";
  if (gs.consecutiveUselessAnswers >= CONSECUTIVE_USELESS_LIMIT) return "useless_answers";
  if (opts.gateReady) return "gate";
  return null;
}


