import { describe, expect, it } from "vitest";
import { SoundManager } from "./sound-manager";

interface MockNode {
  connect: (target: unknown) => void;
  gain?: { value: number };
  playbackRate?: { value: number };
}

function makeMockContext() {
  const started: Array<{ rate: number; volume: number }> = [];
  const sources: Array<{
    loop: boolean;
    playbackRate: { value: number };
    stopCount: number;
    start: () => void;
  }> = [];
  const gains: Array<{ gain: { value: number } }> = [];
  const master: MockNode = { connect: () => undefined };
  // Real Web Audio order: source -> gain -> destination, then source.start();
  // the mock records volume at connect-time and rate at start-time.
  const ctx = {
    destination: master,
    currentTime: 0,
    decodeAudioData: async (data: ArrayBuffer) => ({
      duration: (data as unknown as { byteLength: number }).byteLength,
    }),
    createBufferSource: (): MockNode & {
      buffer: unknown;
      start: () => void;
      stop: () => void;
    } => {
      const node = {
        buffer: null as unknown,
        loop: false,
        playbackRate: { value: 1 },
        stopCount: 0,
        connect: (target: unknown) => void target,
        start: () => {
          const last = started[started.length - 1];
          if (last) {
            last.rate = node.playbackRate?.value ?? 1;
          }
        },
        stop: () => {
          node.stopCount += 1;
        },
      };
      sources.push(node);
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
      gains.push(node as { gain: { value: number } });
      return node;
    },
  };
  return { ctx: ctx as unknown as AudioContext, started, sources, gains };
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

  it("exposes the current mute state via isMuted", async () => {
    const { ctx } = makeMockContext();
    const manager = new SoundManager(ctx, async () => new ArrayBuffer(8));
    expect(manager.isMuted).toBe(false);
    manager.setMuted(true);
    expect(manager.isMuted).toBe(true);
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

  it("loop() returns null for a sample that was never loaded", () => {
    const { ctx } = makeMockContext();
    const manager = new SoundManager(ctx);
    expect(manager.loop("roll")).toBeNull();
  });

  it("loop() starts a looping source at gain zero", async () => {
    const { ctx, sources, gains } = makeMockContext();
    const manager = new SoundManager(ctx, async () => new ArrayBuffer(8));
    await manager.load("roll", "/sounds/roll.ogg");
    const voice = manager.loop("roll");
    expect(voice).not.toBeNull();
    expect(sources[0].loop).toBe(true);
    expect(gains[0].gain.value).toBe(0);
  });

  it("loop voice retunes rate and gain live", async () => {
    const { ctx, sources, gains } = makeMockContext();
    const manager = new SoundManager(ctx, async () => new ArrayBuffer(8));
    await manager.load("roll", "/sounds/roll.ogg");
    const voice = manager.loop("roll");
    voice?.setRate(1.3);
    voice?.setGain(0.3);
    expect(sources[0].playbackRate.value).toBeCloseTo(1.3);
    expect(gains[0].gain.value).toBeCloseTo(0.3);
  });

  it("loop voice stop() halts the source exactly once", async () => {
    const { ctx, sources } = makeMockContext();
    const manager = new SoundManager(ctx, async () => new ArrayBuffer(8));
    await manager.load("roll", "/sounds/roll.ogg");
    const voice = manager.loop("roll");
    voice?.stop();
    voice?.stop();
    expect(sources[0].stopCount).toBe(1);
  });
});
