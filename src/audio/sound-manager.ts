export interface PlayParams {
  rate: number;
  volume: number;
}

/** A live looping voice (ambient sounds such as marble rolls). */
export interface LoopVoice {
  setRate(rate: number): void;
  setGain(gain: number): void;
  stop(): void;
}

/**
 * Tiny sample player over the Web Audio graph. The AudioContext and byte
 * loader are injected so tests can drive a mock graph headlessly.
 */
export class SoundManager {
  private readonly ctx: AudioContext;
  private readonly loadBytes: (url: string) => Promise<ArrayBuffer>;
  private readonly buffers = new Map<string, AudioBuffer>();
  private muted = false;

  constructor(
    ctx: AudioContext,
    loadBytes: (url: string) => Promise<ArrayBuffer> = (url) =>
      fetch(url).then((r) => r.arrayBuffer()),
  ) {
    this.ctx = ctx;
    this.loadBytes = loadBytes;
  }

  async load(name: string, url: string): Promise<void> {
    const data = await this.loadBytes(url);
    this.buffers.set(name, await this.ctx.decodeAudioData(data));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  play(name: string, { rate, volume }: PlayParams): void {
    if (this.muted) {
      return;
    }
    const buffer = this.buffers.get(name);
    if (!buffer) {
      return;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();
  }

  /**
   * Starts a looping voice for a loaded sample. The voice starts silent;
   * retune it live with setRate/setGain and halt it with stop(). Returns
   * null when the sample was never loaded.
   */
  loop(name: string): LoopVoice | null {
    const buffer = this.buffers.get(name);
    if (!buffer) {
      return null;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();
    let stopped = false;
    return {
      setRate: (rate) => {
        source.playbackRate.value = rate;
      },
      setGain: (g) => {
        gain.gain.value = g;
      },
      stop: () => {
        if (!stopped) {
          stopped = true;
          source.stop();
        }
      },
    };
  }
}
