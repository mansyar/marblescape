import { describe, expect, it } from "vitest";
import {
  impactToPlayback,
  impactToVolume,
  MAX_FORCE,
  MAX_RATE,
  MAX_VOLUME,
  MIN_VOLUME,
} from "./pitch";

const linearMidpointVolume = (MIN_VOLUME + MAX_VOLUME) / 2;

describe("impactToPlayback", () => {
  it("keeps the musical band endpoints", () => {
    expect(impactToPlayback(0)).toBeCloseTo(0.85); // BASE_RATE
    expect(impactToPlayback(MAX_FORCE)).toBeCloseTo(MAX_RATE);
  });

  it("rises monotonically without ever screeching", () => {
    let prev = impactToPlayback(0);
    for (let f = 0; f <= MAX_FORCE; f += MAX_FORCE / 20) {
      const rate = impactToPlayback(f);
      expect(rate).toBeGreaterThanOrEqual(prev);
      expect(rate).toBeLessThanOrEqual(MAX_RATE);
      prev = rate;
    }
  });

  it("lets small hits sing (curve eased early, not linear)", () => {
    const t = 0.5;
    const linearRate = 0.85 + (MAX_RATE - 0.85) * t;
    expect(impactToPlayback(MAX_FORCE * t)).toBeGreaterThan(linearRate);
  });
});

describe("impactToVolume", () => {
  it("keeps the volume band endpoints", () => {
    expect(impactToVolume(0)).toBeCloseTo(MIN_VOLUME);
    expect(impactToVolume(MAX_FORCE)).toBeCloseTo(MAX_VOLUME);
  });

  it("grows monotonically within the ceiling", () => {
    let prev = impactToVolume(0);
    for (let f = 0; f <= MAX_FORCE; f += MAX_FORCE / 20) {
      const volume = impactToVolume(f);
      expect(volume).toBeGreaterThanOrEqual(prev);
      expect(volume).toBeLessThanOrEqual(MAX_VOLUME);
      prev = volume;
    }
  });

  it("keeps gentle rolls soft (loudness grows late, not linear)", () => {
    expect(impactToVolume(MAX_FORCE / 2)).toBeLessThan(linearMidpointVolume);
  });
});
