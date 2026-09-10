import type { SettleReason } from "../domain/run-settle";

/** Soft closing tone for a run that ended without reaching the goal. */
export function playSettleCue(
  ctx: AudioContext | null,
  reason: SettleReason,
  muted: boolean,
): void {
  if (muted || ctx?.state !== "running") {
    return;
  }
  // "all-done" already has its cue: the goal plonk (and puzzle chime) play
  // on collection. This cue covers the cases a child would otherwise miss:
  // the marble came to rest somewhere on the board, or the run was capped.
  const plan =
    reason === "at-rest"
      ? { frequency: 523, peak: 0.15, decay: 0.3 } // C5 — calm, neutral
      : reason === "stall"
        ? { frequency: 392, peak: 0.1, decay: 0.25 } // G4 — softer
        : null;
  if (!plan) {
    return;
  }
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = plan.frequency;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(plan.peak, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + plan.decay);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + plan.decay + 0.05);
}
