/** Plays a short two-tone "ding" win chime (no audio asset needed). */
export function playChime(ctx: AudioContext | null): void {
  if (ctx?.state !== "running") {
    return;
  }
  const now = ctx.currentTime;
  const notes = [660, 880]; // E5 → A5, a cheerful rising pair.
  let t = now;
  for (const freq of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
    t += 0.12;
  }
}
