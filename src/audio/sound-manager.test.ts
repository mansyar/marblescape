import { describe, expect, it } from "vitest";
import { SoundManager } from "./sound-manager";

interface MockNode {
  connect: (target: unknown) => void;
  gain?: { value: number };
  playbackRate?: { value: number };
}

function makeMockContext() {
  const started: Array<{ rate: number; volume: number }> = [];
  const master: MockNode = { connect: () => undefined };
  // Real Web Audio order: source -> gain -> destination, then source.start();
  // the mock records volume at connect-time and rate at start-time.
  const ctx = {
    destination: master,
    currentTime: 0,
    decodeAudioData: async (data: ArrayBuffer) => ({
      duration: (data as unknown as { byteLength: number }).byteLength,
    }),
    createBufferSource: (): MockNode & { buffer: unknown; start: () => void } => {
      const node: MockNode & { buffer: unknown; start: () => void } = {
        buffer: null,
        playbackRate: { value: 1 },
        connect: (target: unknown) => void target,
        start: () => {
          const last = started[started.length - 1];
          if (last) {
            last.rate = node.playbackRate?.value ?? 1;
          }
        },
      };
      return node;
    },
    createGain: (): MockNode => {
      const node: MockNode = {
        connect: (target: unknown) => {
          if (target === master) {
            started.push({ rate: 1, volume: node.gain?.value ?? 1 });
          }
        },
        gain: { value: 1 },
      };
      return node;
    },
  };
  return { ctx: ctx as unknown as AudioContext, started };
}

describe("SoundManager", () => {
  it("loads samples and plays one with pitch and volume applied", async () => {
    const { ctx, started } = makeMockContext();
    const manager = new SoundManager(ctx, async () => new ArrayBuffer(8));
    await manager.load("clack", "/sounds/clack.ogg");
    manager.play("clack", { rate: 1.2, volume: 0.5 });
    expect(started).toHaveLength(1);
    expect(started[0].rate).toBeCloseTo(1.2);
    expect(started[0].volume).toBeCloseTo(0.5);
  });

  it("does nothing for a sample that was never loaded", () => {
    const { ctx, started } = makeMockContext();
    const manager = new SoundManager(ctx);
    manager.play("clack", { rate: 1, volume: 1 });
    expect(started).toHaveLength(0);
  });

  it("stays silent while muted and resumes after unmute", async () => {
    const { ctx, started } = makeMockContext();
    const manager = new SoundManager(ctx, async () => new ArrayBuffer(8));
    await manager.load("plonk", "/sounds/plonk.ogg");
    manager.setMuted(true);
    manager.play("plonk", { rate: 1, volume: 1 });
    expect(started).toHaveLength(0);
    manager.setMuted(false);
    manager.play("plonk", { rate: 1, volume: 1 });
    expect(started).toHaveLength(1);
  });

  it("supports multiple samples", async () => {
    const { ctx, started } = makeMockContext();
    const manager = new SoundManager(ctx, async () => new ArrayBuffer(8));
    await manager.load("clack", "/sounds/clack.ogg");
    await manager.load("tick", "/sounds/tick.ogg");
    manager.play("tick", { rate: 1, volume: 1 });
    expect(started).toHaveLength(1);
  });
});
