import { describe, expect, it } from "vitest";
import { playSettleCue } from "./settle-cue";

type RecordedRamp = {
  target: "gain";
  method: string;
  value: number;
  time: number;
};

/** Minimal AudioContext stand-in that records oscillator/gain scheduling. */
function makeFakeCtx(state: AudioContextState = "running") {
  const oscillators: {
    frequency: number;
    stoppedAt: number | null;
  }[] = [];
  const ramps: RecordedRamp[] = [];
  const ctx = {
    state,
    currentTime: 100,
    destination: {},
    createOscillator() {
      const osc = {
        frequency: { value: 0 },
        connect: () => undefined,
        start: () => undefined,
        stop: (t: number) => {
          const entry = oscillators[oscillators.length - 1];
          if (entry) {
            entry.stoppedAt = t;
          }
        },
      };
      const entry = { frequency: 0, stoppedAt: null as number | null };
      // Proxy frequency writes into the recording entry.
      Object.defineProperty(osc.frequency, "value", {
        set: (v: number) => {
          entry.frequency = v;
        },
        get: () => entry.frequency,
      });
      oscillators.push(entry);
      return osc;
    },
    createGain() {
      const gainNode = {
        gain: {
          setValueAtTime: (value: number, time: number) => {
            ramps.push({ target: "gain", method: "setValueAtTime", value, time });
          },
          linearRampToValueAtTime: (value: number, time: number) => {
            ramps.push({ target: "gain", method: "linearRampToValueAtTime", value, time });
          },
          exponentialRampToValueAtTime: (value: number, time: number) => {
            ramps.push({ target: "gain", method: "exponentialRampToValueAtTime", value, time });
          },
        },
        connect: () => undefined,
      };
      return gainNode;
    },
  };
  return { ctx: ctx as unknown as AudioContext, oscillators, ramps };
}

describe("playSettleCue", () => {
  it("is silent when muted (mute governs every voice)", () => {
    const { ctx, oscillators } = makeFakeCtx();
    playSettleCue(ctx, "at-rest", true);
    expect(oscillators).toHaveLength(0);
  });

  it("is silent without a running context", () => {
    const { ctx, oscillators } = makeFakeCtx("suspended");
    playSettleCue(ctx, "at-rest", false);
    playSettleCue(null, "at-rest", false);
    expect(oscillators).toHaveLength(0);
  });

  it("stays quiet when the run ended because all marbles were collected", () => {
    // The goal plonk (and puzzle chime) already mark that moment; a second
    // tone would only muddy it.
    const { ctx, oscillators } = makeFakeCtx();
    playSettleCue(ctx, "all-done", false);
    expect(oscillators).toHaveLength(0);
  });

  it("plays one soft tone when a run ends at rest without a goal", () => {
    const { ctx, oscillators, ramps } = makeFakeCtx();
    playSettleCue(ctx, "at-rest", false);
    expect(oscillators).toHaveLength(1);
    expect(oscillators[0].frequency).toBe(523); // C5 — calm, neutral
    const peak = ramps.find((r) => r.method === "linearRampToValueAtTime");
    expect(peak?.value).toBe(0.15);
    const end = oscillators[0].stoppedAt ?? Number.POSITIVE_INFINITY;
    expect(end - 100).toBeLessThanOrEqual(0.35);
  });

  it("plays an even softer, lower tone for a stalled run", () => {
    const { ctx, oscillators, ramps } = makeFakeCtx();
    playSettleCue(ctx, "stall", false);
    expect(oscillators).toHaveLength(1);
    expect(oscillators[0].frequency).toBe(392); // G4 — quieter than at-rest
    const peak = ramps.find((r) => r.method === "linearRampToValueAtTime");
    expect(peak?.value).toBe(0.1);
  });
});
