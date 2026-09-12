import { describe, expect, it } from "vitest";
import { cuePresentation } from "./cue-config";

describe("cuePresentation", () => {
  it("step 'place' invites the drag: ring at the gap, Ramp pulse, hand traveling", () => {
    expect(cuePresentation("place", false)).toEqual({
      visible: true,
      ringVisible: true,
      rampTilePulse: true,
      playPulse: false,
      handVisible: true,
      handTarget: "gap",
    });
  });

  it("step 'place' under reduced motion parks the hand beside the Ramp tile", () => {
    const presentation = cuePresentation("place", true);
    expect(presentation.handTarget).toBe("tile");
    expect(presentation.ringVisible).toBe(true);
    expect(presentation.rampTilePulse).toBe(true);
  });

  it("step 'play' swaps the ring/Ramp cues for the Play pulse", () => {
    expect(cuePresentation("play", false)).toEqual({
      visible: true,
      ringVisible: false,
      rampTilePulse: false,
      playPulse: true,
      handVisible: true,
      handTarget: "play",
    });
  });

  it("step 'done' shows nothing", () => {
    expect(cuePresentation("done", false)).toEqual({
      visible: false,
      ringVisible: false,
      rampTilePulse: false,
      playPulse: false,
      handVisible: false,
      handTarget: "play",
    });
  });
});
