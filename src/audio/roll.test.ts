import { describe, expect, it, vi } from "vitest";
import { ROLL_MAX_GAIN, ROLL_MAX_SPEED, ROLL_MIN_SPEED, RollVoices, type RollVoice } from "./roll";

/** Opaque stand-ins for marble rigid bodies. */
const a = { id: "a" };

interface FakeVoice extends RollVoice {
  gains: number[];
  rates: number[];
  stopped: boolean;
}

function makeFactory() {
  const created: FakeVoice[] = [];
  const factory = {
    create: (): FakeVoice => {
      const voice: FakeVoice = {
        gains: [],
        rates: [],
        stopped: false,
        setGain(gain: number) {
          voice.gains.push(gain);
        },
        setRate(rate: number) {
          voice.rates.push(rate);
        },
        stop() {
          voice.stopped = true;
        },
      };
      created.push(voice);
      return voice;
    },
  };
  return { factory, created };
}

describe("RollVoices", () => {
  it("creates exactly one voice per rolling marble (NFR: ≤1 voice/marble)", () => {
    const { factory, created } = makeFactory();
    const rolls = new RollVoices(factory);
    const state = [{ marble: a, speed: 3 }];
    rolls.update(state);
    rolls.update(state);
    rolls.update(state);
    expect(created).toHaveLength(1);
  });

  it("never creates a voice for a marble below the roll speed threshold", () => {
    const { factory, created } = makeFactory();
    const rolls = new RollVoices(factory);
    rolls.update([{ marble: a, speed: ROLL_MIN_SPEED / 2 }]);
    expect(created).toHaveLength(0);
  });

  it("raises gain and rate with speed, capped at the roll ceiling", () => {
    const { factory, created } = makeFactory();
    const rolls = new RollVoices(factory);
    rolls.update([{ marble: a, speed: ROLL_MAX_SPEED / 2 }]);
    const voice = created[0];
    const slowGain = voice.gains.at(-1);
    const slowRate = voice.rates.at(-1);
    rolls.update([{ marble: a, speed: ROLL_MAX_SPEED * 3 }]);
    const fastGain = voice.gains.at(-1);
    const fastRate = voice.rates.at(-1);
    expect(slowGain).toBeGreaterThan(0);
    expect(slowGain).toBeLessThan(ROLL_MAX_GAIN);
    expect(fastGain).toBe(ROLL_MAX_GAIN);
    expect(fastRate).toBeGreaterThan(slowRate as number);
  });

  it("stops the voice when the marble drops below the roll threshold", () => {
    const { factory, created } = makeFactory();
    const rolls = new RollVoices(factory);
    rolls.update([{ marble: a, speed: 3 }]);
    rolls.update([{ marble: a, speed: 0.01 }]);
    expect(created[0].stopped).toBe(true);
  });

  it("stops the voice of a reaped marble absent from the update (no leaks)", () => {
    const { factory, created } = makeFactory();
    const rolls = new RollVoices(factory);
    rolls.update([{ marble: a, speed: 3 }]);
    rolls.update([]); // marble reaped between frames
    expect(created[0].stopped).toBe(true);
  });

  it("mute stops all voices; nothing sounds while muted", () => {
    const { factory, created } = makeFactory();
    const rolls = new RollVoices(factory);
    rolls.update([{ marble: a, speed: 3 }]);
    rolls.setMuted(true);
    rolls.update([{ marble: a, speed: 3 }]);
    expect(created[0].stopped).toBe(true);
    expect(created).toHaveLength(1); // no new voices while muted
  });

  it("unmuting lets rolling marbles speak again", () => {
    const { factory, created } = makeFactory();
    const rolls = new RollVoices(factory);
    rolls.setMuted(true);
    rolls.update([{ marble: a, speed: 3 }]);
    rolls.setMuted(false);
    rolls.update([{ marble: a, speed: 3 }]);
    expect(created).toHaveLength(1);
    expect(created[0].stopped).toBe(false);
    expect(created[0].gains.at(-1)).toBeGreaterThan(0);
  });

  it("clear() stops every voice (reset button)", () => {
    const { factory, created } = makeFactory();
    const rolls = new RollVoices(factory);
    rolls.update([
      { marble: a, speed: 3 },
      { marble: { id: "b" }, speed: 2 },
    ]);
    const stopSpy = vi.spyOn(created[0], "stop");
    rolls.clear();
    expect(created.every((voice) => voice.stopped)).toBe(true);
    expect(stopSpy).toHaveBeenCalled();
  });

  it("constants are tuned sanely", () => {
    expect(ROLL_MIN_SPEED).toBeGreaterThan(0);
    expect(ROLL_MAX_SPEED).toBeGreaterThan(ROLL_MIN_SPEED);
    expect(ROLL_MAX_GAIN).toBeGreaterThan(0);
    expect(ROLL_MAX_GAIN).toBeLessThanOrEqual(1);
  });
});
