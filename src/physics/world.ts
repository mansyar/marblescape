import RAPIER from "@dimforge/rapier3d-compat";
import { PHYSICS } from "../domain/physics-config";
import { createFixedStepLoop, type FixedStepLoop } from "./fixed-step-loop";

export type World = RAPIER.World;

/** Rapier must be initialized once before any world creation. */
export async function initPhysics(): Promise<void> {
  await RAPIER.init();
}

export function createPhysicsWorld(): World {
  return new RAPIER.World({
    x: PHYSICS.gravity[0],
    y: PHYSICS.gravity[1],
    z: PHYSICS.gravity[2],
  });
}

/**
 * Steps the world by exactly one fixed timestep. Call from a FixedStepLoop
 * so the simulation rate is decoupled from the render frame rate.
 */
export function stepWorld(world: World, events?: RAPIER.EventQueue | null): void {
  world.timestep = PHYSICS.fixedTimeStep;
  world.step(events ?? undefined);
}

/**
 * Ties a Rapier world to the render loop: each frame's variable elapsed time
 * is converted into 0..maxSubSteps fixed physics steps.
 */
export function createPhysicsTicker(world: World, maxSubSteps?: number): FixedStepLoop {
  return createFixedStepLoop(PHYSICS.fixedTimeStep, () => stepWorld(world), maxSubSteps);
}
