import { describe, expect, it } from "vitest";
import { PerfMeter, clampFrameSample } from "./perf-meter";
import { PERF_MAX_SAMPLE_MS, PERF_WINDOW_FRAMES } from "./quality-config";

describe("clampFrameSample", () => {
  it("passes sane frame deltas through unchanged", () => {
    expect(clampFrameSample(16.7)).toBeCloseTo(16.7);
  });

  it("clamps long gaps (hidden tab, debugger pause) to the max sample", () => {
    expect(clampFrameSample(5000)).toBe(PERF_MAX_SAMPLE_MS);
    expect(clampFrameSample(PERF_MAX_SAMPLE_MS + 1)).toBe(PERF_MAX_SAMPLE_MS);
  });

  it("normalizes junk to zero", () => {
    expect(clampFrameSample(Number.NaN)).toBe(0);
    expect(clampFrameSample(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampFrameSample(-4)).toBe(0);
    expect(clampFrameSample(0)).toBe(0);
  });
});

describe("PerfMeter", () => {
  it("reports zero before any samples", () => {
    const meter = new PerfMeter();
    expect(meter.sampleCount).toBe(0);
    expect(meter.emaFrameMs).toBe(0);
    expect(meter.p95FrameMs).toBe(0);
  });

  it("ignores zero, negative and non-finite samples", () => {
    const meter = new PerfMeter();
    meter.sample(16);
    meter.sample(0);
    meter.sample(-1);
    meter.sample(Number.NaN);
    expect(meter.sampleCount).toBe(1);
    expect(meter.p95FrameMs).toBe(16);
  });

  it("seeds the EMA with the first sample, then smooths with the alpha", () => {
    const meter = new PerfMeter({ emaAlpha: 0.5 });
    meter.sample(10);
    expect(meter.emaFrameMs).toBeCloseTo(10);
    meter.sample(30);
    expect(meter.emaFrameMs).toBeCloseTo(20);
    meter.sample(30);
    expect(meter.emaFrameMs).toBeCloseTo(25);
  });

  it("computes p95 over the filled window with nearest-rank", () => {
    const meter = new PerfMeter({ windowFrames: 20 });
    for (let i = 1; i <= 20; i += 1) meter.sample(i);
    expect(meter.p95FrameMs).toBe(19);
  });

  it("uses only the filled part of the window during warm-up", () => {
    const meter = new PerfMeter({ windowFrames: 100 });
    meter.sample(10);
    meter.sample(20);
    expect(meter.p95FrameMs).toBe(20);
    expect(meter.sampleCount).toBe(2);
  });

  it("evicts the oldest samples once the window wraps", () => {
    const meter = new PerfMeter({ windowFrames: 10 });
    for (let i = 0; i < 10; i += 1) meter.sample(10);
    expect(meter.p95FrameMs).toBe(10);
    for (let i = 0; i < 10; i += 1) meter.sample(100);
    expect(meter.p95FrameMs).toBe(100);
  });

  it("clamps hop artifacts so a hidden tab cannot poison the window", () => {
    const meter = new PerfMeter({ windowFrames: 10 });
    meter.sample(5000);
    expect(meter.p95FrameMs).toBe(PERF_MAX_SAMPLE_MS);
    expect(meter.emaFrameMs).toBe(PERF_MAX_SAMPLE_MS);
  });

  it("defaults to the configured window size", () => {
    const meter = new PerfMeter();
    for (let i = 0; i < PERF_WINDOW_FRAMES; i += 1) meter.sample(16);
    expect(meter.sampleCount).toBe(PERF_WINDOW_FRAMES);
  });
});
