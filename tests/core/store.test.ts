import { createGraphStore, type GraphNode } from "../../src/core"

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

describe("createGraphStore", () => {
  test("supports undo and redo for graph mutations", () => {
    const store = createGraphStore()
    store.addNode(node("0"))
    store.addNode(node("1"))
    store.addEdge({ source: "0", target: "1", weight: 2 })

    expect(store.getState().edges).toHaveLength(1)

    store.undo()
    expect(store.getState().edges).toHaveLength(0)

    store.redo()
    expect(store.getState().edges).toHaveLength(1)
  })

  test("supports generic payloads and event emitters", () => {
    const store = createGraphStore<{ kind: string }, { relation: string }>()
    const events: string[] = []

    store.on("node:add", (payload) => {
      events.push(`node:${payload.data?.kind}`)
    })
    store.on("edge:add", (payload) => {
      events.push(`edge:${payload.data?.relation}`)
    })
    store.on("edge:remove", (payload) => {
      events.push(`edge-removed:${payload.source}->${payload.target}`)
    })

    store.addNode({
      id: "a",
      label: "a",
      x: 10,
      y: 10,
      vx: 0,
      vy: 0,
      fixed: false,
      data: { kind: "alpha" },
    })
    store.addNode({
      id: "b",
      label: "b",
      x: 20,
      y: 20,
      vx: 0,
      vy: 0,
      fixed: false,
      data: { kind: "beta" },
    })
    store.addEdge({
      source: "a",
      target: "b",
      data: { relation: "linked" },
    })
    store.removeEdge("a", "b")

    expect(events).toEqual([
      "node:alpha",
      "node:beta",
      "edge:linked",
      "edge-removed:a->b",
    ])
  })

  test("emits layout and history events", () => {
    const store = createGraphStore()
    const events: string[] = []

    store.on("layout:change", ({ algorithm }) => {
      events.push(`layout:${algorithm}`)
    })
    store.on("history:undo", () => {
      events.push("undo")
    })

    store.addNode(node("0"))
    store.addNode(node("1"))
    store.setCanvasSize(400, 300)
    store.arrangeGrid()
    store.undo()

    expect(events).toEqual(["layout:grid", "undo"])
  })

  test("parses indexed graph text and keeps isolated nodes", () => {
    const store = createGraphStore({
      initialState: {
        indexMode: "0-index",
      },
    })

    const result = store.parseFromText(`
      # comment
      3
      0 1 2 "road A"
      2
    `)

    expect(result.ok).toBe(true)
    expect(store.getState().nodes).toHaveLength(3)
    expect(store.getState().edges).toEqual([
      {
      source: "0",
      target: "1",
      weight: 2,
      label: "road A",
    },
    ])
  })

  test("parses named graphs and regenerates them", () => {
    const store = createGraphStore()
    const result = store.parseFromText(`
      # comment
      Alice
      Bob
      Alice -> Bob 2 "friendship"
    `)

    expect(result.ok).toBe(true)
    expect(store.generateText({ preferNamedFormat: true })).toContain(
      '"Alice" -> "Bob" 2 friendship'
    )
  })

  test("returns validation issues instead of silently ignoring bad lines", () => {
    const store = createGraphStore()
    const result = store.parseFromText(`
      2
      x y
    `)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.message).toMatch(/integer source and target/i)
    }
  })

  test("clears graph state and restores default config", () => {
    const store = createGraphStore({
      initialState: {
        config: {
          nodeRadius: 24,
          edgeIdealLength: 180,
          nodeBackground: "#111111",
          nodeColor: "#222222",
          edgeColor: "#333333",
          labelColor: "#444444",
          nodeLabelFontSize: 18,
          edgeLabelFontSize: 20,
        },
      },
    })

    store.addNode(node("0"))
    store.clearGraph()

    expect(store.getState().nodes).toHaveLength(0)
    expect(store.getState().config.nodeRadius).toBe(19)
  })

  test("emits typed node events", () => {
    const store = createGraphStore()
    const seen: string[] = []
    const unsubscribe = store.on("node:add", (payload) => {
      seen.push(payload.id)
    })

    store.addNode(node("0"))
    unsubscribe()
    store.addNode(node("1"))

    expect(seen).toEqual(["0"])
  })

  test("returns a frozen snapshot that cannot be mutated in place", () => {
    const store = createGraphStore()

    store.addNode(node("0"))

    const first = store.getState()
    const second = store.getState()

    expect(first).toBe(second)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.nodes)).toBe(true)
    expect(Object.isFrozen(first.config)).toBe(true)
    expect(() => {
      first.nodes.push(node("1"))
    }).toThrow(TypeError)
  })

  test("escapes special characters when generating named graph text", () => {
    const store = createGraphStore({
      initialState: {
        nodes: [
          { ...node("node\"1"), label: 'Node "one"' },
          { ...node("path\\2"), label: "Path\nTwo" },
        ],
        edges: [
          {
            source: 'node"1',
            target: "path\\2",
            label: 'Edge "label"\nNext',
          },
        ],
      },
    })

    expect(store.generateText({ preferNamedFormat: true })).toBe(
      '"node\\"1"\n"path\\\\2"\n"node\\"1" -> "path\\\\2" "Edge \\"label\\"\\nNext"'
    )
  })

  test("round-trips escaped named graph text", () => {
    const store = createGraphStore()

    const result = store.parseFromText(
      [
        '"node\\"1"',
        '"path\\\\2"',
        '"node\\"1" -> "path\\\\2" 3 "Edge \\"label\\"\\nNext"',
      ].join("\n")
    )

    expect(result.ok).toBe(true)
    expect(store.generateText({ preferNamedFormat: true })).toBe(
      '"node\\"1"\n"path\\\\2"\n"node\\"1" -> "path\\\\2" 3 "Edge \\"label\\"\\nNext"'
    )
  })

  test("preserves node prefixes in named graph text", () => {
    const store = createGraphStore()

    const result = store.parseFromText(`node:alpha
node:beta
node:alpha -> node:beta`)

    expect(result.ok).toBe(true)
    expect(store.generateText({ preferNamedFormat: true })).toBe(
      '"node:alpha"\n"node:beta"\n"node:alpha" -> "node:beta"'
    )
  })

  test("preserves leading-zero numeric ids by staying in named format", () => {
    const store = createGraphStore({
      initialState: {
        nodes: [node("01"), node("02")],
        edges: [{ source: "01", target: "02" }],
      },
    })

    expect(store.generateText()).toBe('"01"\n"02"\n"01" -> "02"')
  })

  test("falls back to named format for non-contiguous numeric ids", () => {
    const store = createGraphStore({
      initialState: {
        nodes: [node("0"), node("2")],
        edges: [{ source: "0", target: "2" }],
      },
    })

    expect(store.generateText()).toBe('"0"\n"2"\n"0" -> "2"')
  })
})
