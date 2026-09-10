import { describe, expect, it } from "vitest";
import { IMPACT_COOLDOWN_MS, ImpactThrottler } from "./impact-throttle";

/** Opaque stand-ins for marble rigid bodies. */
const a = { id: "a" };
const b = { id: "b" };

describe("ImpactThrottler", () => {
  it("plays the first impact for a marble", () => {
    const t = new ImpactThrottler();
    expect(t.shouldPlay(a, 1000)).toBe(true);
  });

  it("silences the same marble within its cooldown", () => {
    const t = new ImpactThrottler();
    t.shouldPlay(a, 1000);
    expect(t.shouldPlay(a, 1000 + IMPACT_COOLDOWN_MS - 1)).toBe(false);
  });

  it("plays the same marble again once its cooldown has passed", () => {
    const t = new ImpactThrottler();
    t.shouldPlay(a, 1000);
    expect(t.shouldPlay(a, 1000 + IMPACT_COOLDOWN_MS)).toBe(true);
  });

  it("one marble's voice never silences another marble (global-gate bug)", () => {
    const t = new ImpactThrottler();
    t.shouldPlay(a, 1000);
    // b has never spoken: it must be audible immediately, even though a
    // spoke 1ms ago. The old global 60ms gate dropped this entirely.
    expect(t.shouldPlay(b, 1001)).toBe(true);
  });

  it("marble-vs-marble: plays if either voice is free and stamps both", () => {
    const t = new ImpactThrottler();
    t.shouldPlay(a, 1000); // a speaks; b stays free
    // Collision a-b at t=1001: b's voice is free → play, stamp both.
    expect(t.shouldPlay(a, 1001, 60, [b])).toBe(true);
    // Immediately after, both are stamped → silent.
    expect(t.shouldPlay(a, 1002, 60, [b])).toBe(false);
  });

  it("marble-vs-marble: silent if both voices are still cooling down", () => {
    const t = new ImpactThrottler();
    t.shouldPlay(a, 1000);
    t.shouldPlay(b, 1000);
    expect(t.shouldPlay(a, 1010, 60, [b])).toBe(false);
  });

  it("honors a custom cooldown", () => {
    const t = new ImpactThrottler();
    t.shouldPlay(a, 1000, 250);
    expect(t.shouldPlay(a, 1200, 250)).toBe(false);
    expect(t.shouldPlay(a, 1250, 250)).toBe(true);
  });

  it("default cooldown matches the tuned module constant", () => {
    expect(IMPACT_COOLDOWN_MS).toBe(60);
  });

  it("prunes idle voices so long sessions don't grow the map forever", () => {
    const t = new ImpactThrottler();
    const voices: object[] = [];
    for (let i = 0; i < 257; i += 1) {
      const voice = { i };
      voices.push(voice);
      t.shouldPlay(voice, 0);
    }
    // A much later impact on a new voice triggers the prune of idle entries.
    expect(t.shouldPlay({ fresh: true }, 7000)).toBe(true);
    // A pruned voice speaks again even within the cooldown window — proof
    // its entry was dropped rather than still blocking.
    expect(t.shouldPlay(voices[250], 7010)).toBe(true);
  });
});
