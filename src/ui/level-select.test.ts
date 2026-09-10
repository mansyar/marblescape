import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BADGES_KEY } from "../domain/badges";
import { LEVELS } from "../domain/levels";
import { createLevelSelect, hideLevelSelect, showLevelSelect } from "./level-select";

// Minimal element stub: only the DOM surface the level select uses.
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

  replaceChildren(): void {
    for (const child of this.children) {
      child.parent = null;
    }
    this.children.length = 0;
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

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe("createLevelSelect", () => {
  let originalDocument: unknown;
  let originalStorage: unknown;

  beforeEach(() => {
    originalDocument = (globalThis as { document?: unknown }).document;
    originalStorage = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { document?: unknown }).document = {
      createElement: () => new FakeElement(),
    };
    (globalThis as { localStorage?: unknown }).localStorage = memoryStorage();
  });

  afterEach(() => {
    (globalThis as { document?: unknown }).document = originalDocument;
    (globalThis as { localStorage?: unknown }).localStorage = originalStorage;
  });

  function mount(badges = new Set<number>()) {
    const picks: Array<number | "sandbox"> = [];
    const host = new FakeElement();
    const handle = createLevelSelect(host as unknown as HTMLElement, LEVELS, badges, (pick) =>
      picks.push(pick),
    );
    const root = handle.el as unknown as FakeElement;
    const grid = root.children[0];
    const chip = (tile: FakeElement) => tile.find((el) => el.textContent === "✓");
    return { host, handle, root, grid, picks, chip };
  }

  it("renders the sandbox tile plus every shipped level, 7-9 included", () => {
    const { grid } = mount();
    expect(grid.children).toHaveLength(LEVELS.length + 1);
    expect(grid.children[0].dataset.levelSelect).toBe("sandbox");
    const labels = grid.children.slice(1).map((tile) => tile.dataset.levelSelect);
    expect(labels).toEqual(LEVELS.map((level) => `level-${level.id}`));
    expect(labels).toContain("level-9");
  });

  it("renders ✓ chips for solved ids, including the sorting levels", () => {
    const { grid, chip } = mount(new Set([7, 9]));
    expect(chip(grid.children[7])).not.toBeNull();
    expect(chip(grid.children[8])).toBeNull();
    expect(chip(grid.children[9])).not.toBeNull();
  });

  it("re-reads storage on refresh so solves 7-9 appear and stale chips clear", () => {
    const { handle, grid, chip } = mount(new Set([6]));
    expect(chip(grid.children[6])).not.toBeNull();

    const storage = (globalThis as { localStorage?: ReturnType<typeof memoryStorage> })
      .localStorage;
    storage?.setItem(BADGES_KEY, JSON.stringify([7, 8, 9]));
    handle.refreshBadges();
    expect(chip(grid.children[6])).toBeNull();
    expect(chip(grid.children[7])).not.toBeNull();
    expect(chip(grid.children[8])).not.toBeNull();
    expect(chip(grid.children[9])).not.toBeNull();
  });

  it("routes tile picks to the callback", () => {
    const { grid, picks } = mount();
    grid.children[0].click();
    grid.children[8].click();
    expect(picks).toEqual(["sandbox", 8]);
  });

  it("shows and hides via the handle", () => {
    const { handle, root } = mount();
    showLevelSelect(handle);
    expect(root.style.display).toBe("flex");
    hideLevelSelect(handle);
    expect(root.style.display).toBe("none");
  });
});
