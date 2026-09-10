import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSolvedOverlay } from "./solved-overlay";

// Minimal element stub: only the DOM surface the overlay uses.
class FakeStyle {
  [key: string]: unknown;
  setProperty(name: string, value: string): void {
    this[name] = value;
  }
}

class FakeElement {
  style = new FakeStyle();
  dataset: Record<string, string> = {};
  attrs = new Map<string, string>();
  textContent = "";
  children: FakeElement[] = [];
  parent: FakeElement | null = null;
  listeners: Record<string, Array<() => void>> = {};

  appendChild(child: FakeElement): FakeElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      this.appendChild(child);
    }
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  addEventListener(type: string, handler: () => void): void {
    const handlers = this.listeners[type] ?? [];
    handlers.push(handler);
    this.listeners[type] = handlers;
  }

  click(): void {
    for (const handler of this.listeners.click ?? []) {
      handler();
    }
  }

  remove(): void {
    if (this.parent) {
      this.parent.children = this.parent.children.filter((c) => c !== this);
      this.parent = null;
    }
  }

  find(predicate: (el: FakeElement) => boolean): FakeElement | null {
    for (const child of this.children) {
      if (predicate(child)) {
        return child;
      }
      const nested = child.find(predicate);
      if (nested) {
        return nested;
      }
    }
    return null;
  }
}

describe("createSolvedOverlay", () => {
  let originalDocument: unknown;
  const calls: string[] = [];

  beforeEach(() => {
    calls.length = 0;
    originalDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      createElement: () => new FakeElement(),
    };
  });

  afterEach(() => {
    (globalThis as { document?: unknown }).document = originalDocument;
  });

  function mount() {
    const host = new FakeElement();
    const overlay = createSolvedOverlay(host as unknown as HTMLElement, {
      onReplay: () => calls.push("replay"),
      onHome: () => calls.push("home"),
    });
    return { host, overlay, root: overlay.el as unknown as FakeElement };
  }

  it("mounts hidden with a play-again and a home button", () => {
    const { host, root } = mount();
    expect(host.children).toHaveLength(1);
    expect(root.dataset.testid).toBe("solved-overlay");
    expect(String(root.style.cssText)).toContain("display:none");

    const replay = root.find((el) => el.dataset.testid === "solved-replay");
    expect(replay).not.toBeNull();
    expect(replay?.attrs.get("aria-label")).toBe("Play again");
    // Kid-sized touch target (spec: 112 px).
    expect(String(replay?.style.cssText)).toContain("min-width:112px");
    expect(String(replay?.style.cssText)).toContain("min-height:112px");

    const home = root.find((el) => el.attrs.get("aria-label") === "Back to level select");
    expect(home).not.toBeNull();
  });

  it("shows and hides via the handle", () => {
    const { overlay, root } = mount();
    overlay.show();
    expect(root.style.display).toBe("flex");
    overlay.hide();
    expect(root.style.display).toBe("none");
  });

  it("routes button taps to replay and home", () => {
    const { root } = mount();
    const replay = root.find((el) => el.dataset.testid === "solved-replay");
    const home = root.find((el) => el.attrs.get("aria-label") === "Back to level select");
    replay?.click();
    expect(calls).toEqual(["replay"]);
    home?.click();
    expect(calls).toEqual(["replay", "home"]);
  });

  it("keeps the reassuring solved content", () => {
    const { root } = mount();
    expect(root.find((el) => el.textContent === "✓")).not.toBeNull();
    expect(root.find((el) => el.textContent === "Level solved!")).not.toBeNull();
  });
});
