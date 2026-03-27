// @vitest-environment jsdom
import { createRoot } from "react-dom/client"
import React from "react"

import { createGraphStore, type GraphNode } from "../../src/core"
import { createPersistPlugin } from "../../src/persist"
import { useGraphSelector, useGraphStore } from "../../src/react"

function node(id: string): GraphNode {
  return {
    id,
    label: id,
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    fixed: false,
  }
}

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

describe("react hooks", () => {
  test("subscribe to store updates and selectors", () => {
    const store = createGraphStore()
    const container = document.createElement("div")
    const root = createRoot(container)

    function App() {
      const state = useGraphStore(store)
      const edgeCount = useGraphSelector(store, (snapshot) => snapshot.edges.length)
      return React.createElement(
        "div",
        null,
        React.createElement("span", { "data-testid": "nodes" }, String(state.nodes.length)),
        React.createElement("span", { "data-testid": "edges" }, String(edgeCount))
      )
    }

    React.act(() => {
      root.render(React.createElement(App))
    })

    expect(container.querySelector('[data-testid="nodes"]')?.textContent).toBe("0")
    expect(container.querySelector('[data-testid="edges"]')?.textContent).toBe("0")

    React.act(() => {
      store.addNode(node("0"))
      store.addNode(node("1"))
      store.addEdge({ source: "0", target: "1" })
    })

    expect(container.querySelector('[data-testid="nodes"]')?.textContent).toBe("2")
    expect(container.querySelector('[data-testid="edges"]')?.textContent).toBe("1")

    React.act(() => {
      root.unmount()
    })
  })

  test("restores persisted state before rendering and keeps storage synced", () => {
    const storage = new MemoryStorage()
    const plugin = createPersistPlugin({
      key: "graph",
      storage,
    })
    const seedStore = createGraphStore()
    seedStore.addNode(node("restored"))
    plugin.save(seedStore.getState())

    const store = createGraphStore()
    const detach = plugin.attach(store)
    const container = document.createElement("div")
    const root = createRoot(container)

    function App() {
      const state = useGraphStore(store)
      return React.createElement(
        "span",
        { "data-testid": "nodes" },
        String(state.nodes.length)
      )
    }

    React.act(() => {
      root.render(React.createElement(App))
    })

    expect(container.querySelector('[data-testid="nodes"]')?.textContent).toBe("1")

    React.act(() => {
      store.addNode(node("next"))
    })

    expect(container.querySelector('[data-testid="nodes"]')?.textContent).toBe("2")
    expect(plugin.load()?.nodes).toHaveLength(2)

    React.act(() => {
      root.unmount()
    })
    detach()
  })
})
