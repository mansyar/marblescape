/**
 * Rolling-marble voices (spec FR2): one looping roll sound per moving
 * marble, with gain and playback rate driven by the marble's speed.
 * One voice per marble — never more. Voices stop when a marble slows
 * below the roll threshold or is reaped, so sessions never leak voices.
 */

/** A marble must be moving at least this fast to be heard rolling. */
export const ROLL_MIN_SPEED = 0.5;

/** Speed at which a marble's roll reaches full loudness. */
export const ROLL_MAX_SPEED = 6;

/** Loudest roll gain (well under one so rolls sit behind impact clacks). */
export const ROLL_MAX_GAIN = 0.4;

const BASE_RATE = 0.8;
const RATE_SPAN = 0.4;
/** Loudness grows with speed, but rolls stay behind impact clacks. */
const GAIN_EXPONENT = 0.8;

/** A single looping roll sound owned by one marble. */
export interface RollVoice {
  setGain(gain: number): void;
  setRate(rate: number): void;
  stop(): void;
}

/** Creates looping roll voices; implemented on top of the audio engine. */
export interface RollVoiceFactory {
  create(): RollVoice;
}

export class RollVoices {
  private readonly voices = new Map<object, RollVoice>();
  private readonly factory: RollVoiceFactory;
  private muted = false;

  constructor(factory: RollVoiceFactory) {
    this.factory = factory;
  }

  /** Master-mute awareness; while muted no roll may sound at all. */
  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /**
   * Called once per frame with the current marble speeds. Creates/stops
   * voices as needed and retunes the survivors. Marbles absent from the
   * list (reaped) or below the threshold have their voices stopped.
   */
  update(states: { marble: object; speed: number }[]): void {
    const rolling = new Set<object>();
    for (const { marble, speed } of states) {
      if (this.muted || speed < ROLL_MIN_SPEED) {
        continue;
      }
      rolling.add(marble);
      let voice = this.voices.get(marble);
      if (!voice) {
        voice = this.factory.create();
        this.voices.set(marble, voice);
      }
      const t = Math.min(speed / ROLL_MAX_SPEED, 1);
      voice.setGain(ROLL_MAX_GAIN * t ** GAIN_EXPONENT);
      voice.setRate(BASE_RATE + RATE_SPAN * t);
    }
    for (const [marble, voice] of this.voices) {
      if (!rolling.has(marble)) {
        voice.stop();
        this.voices.delete(marble);
      }
    }
  }

  /** Stops every voice (reset button). */
  clear(): void {
    for (const voice of this.voices.values()) {
      voice.stop();
    }
    this.voices.clear();
  }
}
