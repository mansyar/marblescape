import { PERF_EMA_ALPHA, PERF_MAX_SAMPLE_MS, PERF_WINDOW_FRAMES } from "./quality-config";

/**
 * Normalizes a raw frame delta for metering: junk (negative, zero, non-finite)
 * counts as zero so it can be dropped; long gaps (hidden tab, debugger pause)
 * are clamped so they cannot poison the window they are recorded into.
 */
export function clampFrameSample(deltaMs: number): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return 0;
  }
  return Math.min(deltaMs, PERF_MAX_SAMPLE_MS);
}

export interface PerfMeterOptions {
  /** Frames kept for the rolling p95. */
  windowFrames?: number;
  /** EMA smoothing factor (0..1). */
  emaAlpha?: number;
}

/**
 * Rolling frame-pacing meter: an EMA (dev readout) plus a nearest-rank p95
 * over the last `windowFrames` deltas (the policy input). Pure and
 * deterministic — callers feed it rAF deltas; it owns no clock and gets
 * updated even when rendering stalls, because callers sample on every frame.
 */
export class PerfMeter {
  private readonly samples: Float64Array;
  private readonly emaAlpha: number;
  private filled = 0;
  private next = 0;
  private counted = 0;
  private ema = 0;
  private cachedP95: number | null = null;

  constructor(options: PerfMeterOptions = {}) {
    const windowFrames =
      options.windowFrames === undefined || !Number.isFinite(options.windowFrames)
        ? PERF_WINDOW_FRAMES
        : Math.max(1, Math.floor(options.windowFrames));
    this.samples = new Float64Array(windowFrames);
    const alpha = options.emaAlpha;
    this.emaAlpha =
      alpha === undefined || !Number.isFinite(alpha)
        ? PERF_EMA_ALPHA
        : Math.min(1, Math.max(0, alpha));
  }

  /** Total frame samples recorded (drives the warm-up gate). */
  get sampleCount(): number {
    return this.counted;
  }

  /** Smoothed frame time in ms (0 before the first sample). */
  get emaFrameMs(): number {
    return this.ema;
  }

  /** Nearest-rank 95th percentile of the filled window (0 when empty). */
  get p95FrameMs(): number {
    if (this.filled === 0) {
      return 0;
    }
    if (this.cachedP95 === null) {
      const sorted = Array.from(this.samples.subarray(0, this.filled)).sort((a, b) => a - b);
      const rank = Math.max(0, Math.ceil(0.95 * sorted.length) - 1);
      this.cachedP95 = sorted[rank];
    }
    return this.cachedP95;
  }

  /** Record one frame delta (ms). Junk is dropped; long gaps are clamped. */
  sample(deltaMs: number): void {
    const clamped = clampFrameSample(deltaMs);
    if (clamped <= 0) {
      return;
    }
    this.samples[this.next] = clamped;
    this.next = (this.next + 1) % this.samples.length;
    if (this.filled < this.samples.length) {
      this.filled += 1;
    }
    this.ema = this.counted === 0 ? clamped : this.ema + this.emaAlpha * (clamped - this.ema);
    this.counted += 1;
    this.cachedP95 = null;
  }
}
