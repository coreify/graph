import {
  decodeGraphStateFromShare,
  deserialize,
  encodeGraphStateForShare,
  serialize,
  toAdjacencyList,
  toAdjacencyMatrix,
  toDOT,
} from "../../src/serialization"
import type { GraphState } from "../../src/core"
import { expectTypeOf } from "vitest"

const state: GraphState = {
  nodes: [
    { id: "0", label: "Zero", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
    { id: "1", label: "One", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
  ],
  edges: [{ source: "0", target: "1", weight: 3, label: "road" }],
  direction: "directed",
  indexMode: "0-index",
  config: {
    nodeRadius: 19,
    edgeIdealLength: 140,
    nodeBackground: "#fff000",
    nodeColor: "#111111",
    edgeColor: "#222222",
    labelColor: "#333333",
    nodeLabelFontSize: 16,
    edgeLabelFontSize: 18,
  },
  customLabels: {},
  canvasSize: {
    width: 800,
    height: 600,
  },
}

describe("serialization", () => {
  test("serializes and deserializes graph state", () => {
    const roundTrip = deserialize(serialize(state))
    expect(roundTrip).toEqual(state)
  })

  test("encodes and decodes shareable payloads", () => {
    const encoded = encodeGraphStateForShare(state)
    expect(decodeGraphStateFromShare(encoded)).toEqual(state)
  })

  test("builds adjacency matrices and dot output", () => {
    const adjacency = toAdjacencyList(state.nodes, state.edges, { direction: "directed" })
    const weightedAdjacency = toAdjacencyList(state.nodes, state.edges, {
      direction: "directed",
      weighted: true,
    })
    const matrix = toAdjacencyMatrix(state.nodes, state.edges, {
      direction: "directed",
      weighted: true,
    })

    expectTypeOf(adjacency).toEqualTypeOf<Map<string, string[]>>()
    expectTypeOf(weightedAdjacency).toEqualTypeOf<
      Map<string, Array<{ id: string; weight: number }>>
    >()
    expectTypeOf(matrix).toEqualTypeOf<number[][]>()

    expect(adjacency.get("0")).toEqual(["1"])
    expect(weightedAdjacency.get("0")).toEqual([{ id: "1", weight: 3 }])

    expect(matrix).toEqual([
      [0, 3],
      [0, 0],
    ])

    expect(toDOT(state.nodes, state.edges, { directed: true, graphName: "Roads" })).toContain(
      'digraph "Roads"'
    )
  })

  test("falls back to safe canvas dimensions for malformed payloads", () => {
    const restored = deserialize(
      JSON.stringify({
        ...state,
        canvasSize: { width: -1, height: "bad" },
      })
    )

    expect(restored.canvasSize).toEqual({ width: 800, height: 600 })
  })

  test("rejects malformed node and edge shapes", () => {
    expect(() =>
      deserialize(
        JSON.stringify({
          ...state,
          nodes: [{ ...state.nodes[0], x: "bad" }],
        })
      )
    ).toThrow(/invalid graph state payload/i)

    expect(() =>
      deserialize(
        JSON.stringify({
          ...state,
          edges: [{ ...state.edges[0], weight: "bad" }],
        })
      )
    ).toThrow(/invalid graph state payload/i)
  })

  test("rejects invalid graph enums and non-plain metadata containers", () => {
    expect(() =>
      deserialize(
        JSON.stringify({
          ...state,
          direction: "sideways",
        })
      )
    ).toThrow(/invalid graph state payload/i)

    expect(() =>
      deserialize(
        JSON.stringify({
          ...state,
          indexMode: "2-index",
        })
      )
    ).toThrow(/invalid graph state payload/i)

    expect(() =>
      deserialize(
        JSON.stringify({
          ...state,
          config: [],
        })
      )
    ).toThrow(/invalid graph state payload/i)

    expect(() =>
      deserialize(
        JSON.stringify({
          ...state,
          customLabels: [],
        })
      )
    ).toThrow(/invalid graph state payload/i)
  })

  test("escapes special characters in DOT output", () => {
    const dot = toDOT(
      [
        { ...state.nodes[0], id: 'node"1', label: 'Line 1\nLine 2' },
        { ...state.nodes[1], id: "path\\node", label: 'Back\\slash "quote"' },
      ],
      [
        {
          source: 'node"1',
          target: 'path\\node',
          label: 'Edge "label"\nNext',
        },
      ],
      { directed: true, graphName: 'Graph "A"\\Test' }
    )

    expect(dot).toContain('digraph "Graph \\"A\\"\\\\Test" {')
    expect(dot).toContain('"node\\"1" [label="Line 1\\nLine 2"];')
    expect(dot).toContain('"path\\\\node" [label="Back\\\\slash \\"quote\\""];')
    expect(dot).toContain('"node\\"1" -> "path\\\\node" [label="Edge \\"label\\"\\nNext"];')
  })
})
