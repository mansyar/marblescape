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

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

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

  function mount(
    badges = new Set<number>(),
    preview?: (pick: number | "sandbox") => string | null,
  ) {
    const picks: Array<number | "sandbox"> = [];
    const host = new FakeElement();
    const handle = createLevelSelect(
      host as unknown as HTMLElement,
      LEVELS,
      badges,
      (pick) => picks.push(pick),
      preview ? { preview } : undefined,
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

  it("renders picture tiles with aria-labels when previews are available", () => {
    const { grid, chip } = mount(new Set([3]), (pick) => `data:image/png;base64,${pick}`);
    const sandbox = grid.children[0];
    const firstLevel = grid.children[1];
    expect(sandbox.textContent).toBe("");
    expect(firstLevel.textContent).toBe("");
    expect((sandbox.children[0] as unknown as { src: string }).src).toBe(
      "data:image/png;base64,sandbox",
    );
    expect((firstLevel.children[0] as unknown as { src: string }).src).toBe(
      "data:image/png;base64,1",
    );
    expect(sandbox.attrs.get("aria-label")).toBe("Sandbox");
    expect(firstLevel.attrs.get("aria-label")).toBe("Level 1");
    expect(chip(grid.children[3])).not.toBeNull();
  });

  it("falls back to glyph tiles when previews are unavailable", () => {
    const { grid } = mount(new Set(), () => null);
    expect(grid.children[0].textContent).toBe("🏖️");
    expect(grid.children[1].textContent).toBe("1");
    expect(grid.children[1].attrs.get("aria-label")).toBe("Level 1");
  });

  it("queries the provider again on refresh so the sandbox tile updates", () => {
    let url = "data:image/png;base64,old";
    const { handle, grid } = mount(new Set(), (pick) => (pick === "sandbox" ? url : null));
    url = "data:image/png;base64,new";
    handle.refreshBadges();
    expect((grid.children[0].children[0] as unknown as { src: string }).src).toBe(
      "data:image/png;base64,new",
    );
  });

  it("shows and hides via the handle", () => {
    const { handle, root } = mount();
    showLevelSelect(handle);
    expect(root.style.display).toBe("flex");
    hideLevelSelect(handle);
    expect(root.style.display).toBe("none");
  });
});
