import {
  bfs,
  connectedComponents,
  dijkstra,
  hasCycle,
  topoSort,
} from "../../src/algorithms"
import type { GraphEdge, GraphNode } from "../../src/core"

const nodes: GraphNode[] = [
  { id: "A", label: "A", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
  { id: "B", label: "B", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
  { id: "C", label: "C", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
  { id: "D", label: "D", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
]

describe("algorithms", () => {
  test("runs bfs with path reconstruction", () => {
    const edges: GraphEdge[] = [
      { source: "A", target: "B" },
      { source: "B", target: "C" },
      { source: "A", target: "D" },
    ]

    const result = bfs(nodes, edges, "A")
    expect(result.order).toEqual(["A", "B", "D", "C"])
    expect(result.pathTo("C")).toEqual(["A", "B", "C"])
  })

  test("runs dijkstra on weighted graphs", () => {
    const edges: GraphEdge[] = [
      { source: "A", target: "B", weight: 5 },
      { source: "A", target: "C", weight: 1 },
      { source: "C", target: "B", weight: 1 },
    ]

    const result = dijkstra(nodes, edges, "A")
    expect(result.distances.B).toBe(2)
    expect(result.pathTo("B")).toEqual(["A", "C", "B"])
  })

  test("detects connected components and cycles", () => {
    const edges: GraphEdge[] = [
      { source: "A", target: "B" },
      { source: "B", target: "C" },
      { source: "C", target: "A" },
    ]

    expect(connectedComponents(nodes, edges)).toEqual([["A", "C", "B"], ["D"]])
    expect(hasCycle(nodes, edges)).toBe(true)
  })

  test("topologically sorts directed acyclic graphs", () => {
    const edges: GraphEdge[] = [
      { source: "A", target: "B" },
      { source: "A", target: "C" },
      { source: "C", target: "D" },
    ]

    expect(topoSort(nodes, edges)).toEqual(["A", "B", "C", "D"])
  })

  test("rejects missing start nodes for traversals and shortest paths", () => {
    const edges: GraphEdge[] = [{ source: "A", target: "B" }]

    expect(() => bfs(nodes, edges, "missing")).toThrow(/does not exist/i)
    expect(() => dijkstra(nodes, edges, "missing")).toThrow(/does not exist/i)
  })
})
