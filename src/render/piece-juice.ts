import {
  REJECT_WIGGLE_DURATION,
  ROTATE_TWEEN_DURATION,
  SNAP_BOUNCE_DURATION,
  rejectWiggleAngle,
  rotateYaw,
  snapBounceScale,
} from "./piece-anim";

/** Anything with a 3-axis scale and a Y rotation (a three.js Object3D does). */
export interface JuiceTarget {
  scale: { set(x: number, y: number, z: number): void };
  rotation: { y: number };
}

type Tween =
  | { kind: "bounce"; target: JuiceTarget; t: number }
  | { kind: "wiggle"; target: JuiceTarget; t: number; baseYaw: number }
  | { kind: "rotate"; target: JuiceTarget; t: number; from: number; to: number };

const DURATIONS: Record<Tween["kind"], number> = {
  bounce: SNAP_BOUNCE_DURATION,
  wiggle: REJECT_WIGGLE_DURATION,
  rotate: ROTATE_TWEEN_DURATION,
};

/**
 * Runs the interaction-juice tweens over piece meshes. The game state is
 * always applied immediately; this only animates the visuals and each target
 * gets at most one tween at a time (a new one restores rest and replaces it).
 */
export class PieceJuice {
  private tweens: Tween[] = [];

  /** Live tween count (tests / diagnostics). */
  get activeCount(): number {
    return this.tweens.length;
  }

  /** Valid drop: squash the piece on landing, pop past full size, settle. */
  snapBounce(target: JuiceTarget): void {
    this.cancel(target);
    this.tweens.push({ kind: "bounce", target, t: 0 });
    this.apply(this.tweens[this.tweens.length - 1]);
  }

  /** Invalid drop: shake the piece side to side, then return to its yaw. */
  wiggle(target: JuiceTarget): void {
    this.cancel(target);
    this.tweens.push({ kind: "wiggle", target, t: 0, baseYaw: target.rotation.y });
  }

  /** Tap-rotate: spin the mesh from the old yaw to the new one. */
  rotate(target: JuiceTarget, from: number, to: number): void {
    this.cancel(target);
    this.tweens.push({ kind: "rotate", target, t: 0, from, to });
  }

  /** Advances every tween; completed ones are settled exactly at rest. */
  update(dt: number): void {
    const done: Tween[] = [];
    for (const tween of this.tweens) {
      tween.t += dt / DURATIONS[tween.kind];
      this.apply(tween);
      if (tween.t >= 1) {
        done.push(tween);
      }
    }
    for (const tween of done) {
      this.settle(tween);
      this.tweens = this.tweens.filter((t) => t !== tween);
    }
  }

  private apply(tween: Tween): void {
    switch (tween.kind) {
      case "bounce": {
        const s = snapBounceScale(tween.t);
        tween.target.scale.set(s, s, s);
        break;
      }
      case "wiggle":
        tween.target.rotation.y = tween.baseYaw + rejectWiggleAngle(tween.t);
        break;
      case "rotate":
        tween.target.rotation.y = rotateYaw(tween.from, tween.to, tween.t);
        break;
    }
  }

  private settle(tween: Tween): void {
    switch (tween.kind) {
      case "bounce":
        tween.target.scale.set(1, 1, 1);
        break;
      case "wiggle":
        tween.target.rotation.y = tween.baseYaw;
        break;
      case "rotate":
        tween.target.rotation.y = tween.to;
        break;
    }
  }

  /** Drops a target's live tween, restoring the state it owned. */
  private cancel(target: JuiceTarget): void {
    const cancelled = this.tweens.filter((t) => t.target === target);
    for (const tween of cancelled) {
      if (tween.kind === "bounce") {
        tween.target.scale.set(1, 1, 1);
      }
    }
    this.tweens = this.tweens.filter((t) => !cancelled.includes(t));
  }
}
