import {
  createPersistPlugin,
  loadFromLocalStorage,
  removeFromLocalStorage,
  saveToLocalStorage,
} from "../../src/persist"
import { createGraphStore } from "../../src/core"
import type { GraphState } from "../../src/core"

class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  get length() {
    return this.data.size
  }

  clear() {
    this.data.clear()
  }

  getItem(key: string) {
    return this.data.get(key) ?? null
  }

  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.data.delete(key)
  }

  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
}

class ThrowingStorage implements Storage {
  get length() {
    return 0
  }

  clear() {}

  getItem() {
    throw new Error("blocked")
  }

  key() {
    return null
  }

  removeItem() {
    throw new Error("blocked")
  }

  setItem() {
    throw new Error("blocked")
  }
}

const state: GraphState = {
  nodes: [{ id: "0", label: "0", x: 0, y: 0, vx: 0, vy: 0, fixed: false }],
  edges: [],
  direction: "undirected",
  indexMode: "0-index",
  config: {
    nodeRadius: 19,
    edgeIdealLength: 140,
    nodeBackground: "#ffffff",
    nodeColor: "#111111",
    edgeColor: "#111111",
    labelColor: "#111111",
    nodeLabelFontSize: 16,
    edgeLabelFontSize: 18,
  },
  customLabels: {},
  canvasSize: { width: 640, height: 480 },
}

describe("persist helpers", () => {
  test("saves, loads, and removes snapshots from local storage", () => {
    const storage = new MemoryStorage()

    expect(saveToLocalStorage("graph", state, { storage })).toBe(true)
    expect(loadFromLocalStorage("graph", { storage })).toEqual(state)
    expect(removeFromLocalStorage("graph", { storage })).toBe(true)
    expect(loadFromLocalStorage("graph", { storage })).toBeNull()
  })

  test("returns null for malformed snapshots instead of throwing", () => {
    const storage = new MemoryStorage()
    storage.setItem("graph", "{not-json")

    expect(loadFromLocalStorage("graph", { storage })).toBeNull()

    storage.setItem(
      "graph",
      JSON.stringify({
        nodes: [{ id: "0" }],
        edges: [],
        direction: "undirected",
        indexMode: "0-index",
        config: {},
        customLabels: {},
      })
    )

    expect(loadFromLocalStorage("graph", { storage })).toBeNull()
  })

  test("creates a persistence plugin that restores and subscribes to a store", () => {
    const storage = new MemoryStorage()
    const plugin = createPersistPlugin({
      key: "graph",
      storage,
    })

    plugin.save(state)

    const store = createGraphStore()
    const detach = plugin.attach(store)

    expect(store.getState().nodes).toHaveLength(1)

    store.addNode({
      id: "1",
      label: "1",
      x: 10,
      y: 10,
      vx: 0,
      vy: 0,
      fixed: false,
    })

    const restored = plugin.load()
    expect(restored?.nodes).toHaveLength(2)

    detach()
  })

  test("fails closed when storage operations throw", () => {
    const storage = new ThrowingStorage()

    expect(saveToLocalStorage("graph", state, { storage })).toBe(false)
    expect(loadFromLocalStorage("graph", { storage })).toBeNull()
    expect(removeFromLocalStorage("graph", { storage })).toBe(false)
  })
})
