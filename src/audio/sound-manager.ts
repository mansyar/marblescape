export interface PlayParams {
  rate: number;
  volume: number;
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
}
