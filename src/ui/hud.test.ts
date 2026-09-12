import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Game } from "../game/game";
import { createHud, hudRightInset, LANDSCAPE_HUD_CLEARANCE_PX } from "./hud";

class FakeStyle {
  cssText = "";
  right = "";
  [key: string]: unknown;

  setProperty(key: string, value: string): void {
    this[key] = value;
  }
}

class FakeElement {
  tagName: string;
  style = new FakeStyle();
  dataset: Record<string, string> = {};
  textContent = "";
  children: FakeElement[] = [];
  private listeners = new Map<string, Array<() => void>>();

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
  }

  appendChild(node: FakeElement): void {
    this.children.push(node);
  }

  addEventListener(type: string, listener: () => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: () => void): void {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      list.filter((existing) => existing !== listener),
    );
  }

  fire(type: string): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener();
    }
  }
}

interface FakeWindow {
  innerWidth: number;
  innerHeight: number;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  fire(type: string): void;
}

function fakeWindow(width: number, height: number): FakeWindow {
  const listeners = new Map<string, Array<() => void>>();
  return {
    innerWidth: width,
    innerHeight: height,
    addEventListener(type, listener) {
      const list = listeners.get(type) ?? [];
      list.push(listener);
      listeners.set(type, list);
    },
    removeEventListener(type, listener) {
      const list = listeners.get(type) ?? [];
      listeners.set(
        type,
        list.filter((existing) => existing !== listener),
      );
    },
    fire(type) {
      for (const listener of [...(listeners.get(type) ?? [])]) {
        listener();
      }
    },
  };
}

function stubGame(): Game {
  return {
    initAudio: () => Promise.resolve(),
    play: () => {},
    setSoundOn: () => {},
    reset: () => {},
  } as unknown as Game;
}

describe("hud placement", () => {
  let originalDocument: unknown;
  let originalWindow: unknown;
  let originalStorage: unknown;

  beforeEach(() => {
    originalDocument = (globalThis as { document?: unknown }).document;
    originalWindow = (globalThis as { window?: unknown }).window;
    originalStorage = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { document?: unknown }).document = {
      createElement: (tagName: string) => new FakeElement(tagName),
    };
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => null,
      setItem: () => {},
    };
  });

  afterEach(() => {
    (globalThis as { document?: unknown }).document = originalDocument;
    (globalThis as { window?: unknown }).window = originalWindow;
    (globalThis as { localStorage?: unknown }).localStorage = originalStorage;
    vi.useRealTimers();
  });

  it("clears the landscape palette rail", () => {
    const inset = hudRightInset("landscape");
    expect(inset).toContain(`+ ${LANDSCAPE_HUD_CLEARANCE_PX}px`);
    expect(inset).toContain("env(safe-area-inset-right)");
    expect(inset).not.toBe(hudRightInset("portrait"));
  });

  it("keeps the plain safe-area inset in portrait", () => {
    expect(hudRightInset("portrait")).toBe("max(10px, env(safe-area-inset-right))");
  });

  it("applies the landscape clearance to the bar and tracks resizes", () => {
    vi.useFakeTimers();
    const win = fakeWindow(844, 390);
    (globalThis as { window?: unknown }).window = win;

    const hud = createHud(stubGame(), new FakeElement("div") as unknown as HTMLElement);
    expect(hud.bar.style.right).toContain(`+ ${LANDSCAPE_HUD_CLEARANCE_PX}px`);

    win.innerWidth = 390;
    win.innerHeight = 844;
    win.fire("resize");
    vi.advanceTimersByTime(100);
    expect(hud.bar.style.right).toBe("max(10px, env(safe-area-inset-right))");
  });
});
