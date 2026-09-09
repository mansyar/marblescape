import { describe, expect, it } from "vitest";
import { createUpdateState, dismiss, isReady, needRefresh, update } from "./pwa-update";

describe("pwa update state machine", () => {
  it("starts idle", () => {
    expect(createUpdateState()).toEqual({ status: "idle" });
    expect(isReady(createUpdateState())).toBe(false);
  });

  it("transitions idle -> ready on needRefresh", () => {
    const state = needRefresh(createUpdateState());
    expect(state.status).toBe("ready");
    expect(isReady(state)).toBe(true);
  });

  it("stays ready on repeated needRefresh events", () => {
    const once = needRefresh(createUpdateState());
    const twice = needRefresh(once);
    expect(twice).toBe(once);
  });

  it("transitions ready -> activating on update", () => {
    const state = update(needRefresh(createUpdateState()));
    expect(state.status).toBe("activating");
    expect(isReady(state)).toBe(false);
  });

  it("transitions ready -> idle on dismiss", () => {
    const state = dismiss(needRefresh(createUpdateState()));
    expect(state.status).toBe("idle");
  });

  it("ignores update and dismiss while idle", () => {
    const idle = createUpdateState();
    expect(update(idle)).toBe(idle);
    expect(dismiss(idle)).toBe(idle);
  });

  it("treats activating as terminal", () => {
    const activating = update(needRefresh(createUpdateState()));
    expect(update(activating)).toBe(activating);
    expect(dismiss(activating)).toBe(activating);
    expect(needRefresh(activating)).toBe(activating);
  });
});
