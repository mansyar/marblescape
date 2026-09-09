/**
 * Pure state machine for the service-worker update prompt.
 *
 * idle      — no update known
 * ready     — a new version finished installing; show the banner
 * activating— the user tapped Update; the page is about to reload
 */
export type UpdateStatus = "idle" | "ready" | "activating";

export interface UpdateState {
  status: UpdateStatus;
}

export function createUpdateState(): UpdateState {
  return { status: "idle" };
}

export function needRefresh(state: UpdateState): UpdateState {
  if (state.status !== "idle") return state;
  return { status: "ready" };
}

export function update(state: UpdateState): UpdateState {
  if (state.status !== "ready") return state;
  return { status: "activating" };
}

export function dismiss(state: UpdateState): UpdateState {
  if (state.status !== "ready") return state;
  return { status: "idle" };
}

export function isReady(state: UpdateState): boolean {
  return state.status === "ready";
}
