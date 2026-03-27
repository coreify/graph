import {
  bellmanFord,
  betweennessCentrality,
  connectedComponents,
  degreeCentrality,
  dfs,
  hasCycle,
  kruskal,
  prim,
  stronglyConnectedComponents,
  topoSort,
} from "../../src/algorithms"
import type { GraphEdge, GraphNode } from "../../src/core"

const nodes: GraphNode[] = [
  { id: "A", label: "A", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
  { id: "B", label: "B", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
  { id: "C", label: "C", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
  { id: "D", label: "D", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
]

function sortComponents(components: string[][]) {
  return components
    .map((component) => [...component].sort())
    .sort((left, right) => left.join(",").localeCompare(right.join(",")))
}

describe("advanced algorithms", () => {
  test("runs dfs and cycle detection on directed graphs", () => {
    const edges: GraphEdge[] = [
      { source: "A", target: "B" },
      { source: "B", target: "C" },
      { source: "C", target: "A" },
    ]

    expect(dfs(nodes, edges, "A", { direction: "directed" }).pathTo("C")).toEqual(["A", "B", "C"])
    expect(hasCycle(nodes, edges, { direction: "directed" })).toBe(true)
  })

  test("runs bellman-ford with negative weights", () => {
    const edges: GraphEdge[] = [
      { source: "A", target: "B", weight: 4 },
      { source: "A", target: "C", weight: 5 },
      { source: "C", target: "B", weight: -3 },
    ]

    const result = bellmanFord(nodes, edges, "A", { direction: "directed" })
    expect(result.distances.B).toBe(2)
    expect(result.hasNegativeCycle).toBe(false)
  })

  test("finds connected and strongly connected components", () => {
    const edges: GraphEdge[] = [
      { source: "A", target: "B" },
      { source: "B", target: "A" },
      { source: "C", target: "D" },
    ]

    expect(sortComponents(connectedComponents(nodes, edges))).toEqual([
      ["A", "B"],
      ["C", "D"],
    ])
    expect(sortComponents(stronglyConnectedComponents(nodes, edges))).toEqual([
      ["A", "B"],
      ["C"],
      ["D"],
    ])
  })

  test("computes MSTs with kruskal and prim", () => {
    const edges: GraphEdge[] = [
      { source: "A", target: "B", weight: 3 },
      { source: "A", target: "C", weight: 1 },
      { source: "B", target: "C", weight: 1 },
    ]

    expect(kruskal(nodes.slice(0, 3), edges).totalWeight).toBe(2)
    expect(prim(nodes.slice(0, 3), edges).totalWeight).toBe(2)
  })

  test("computes centrality scores", () => {
    const edges: GraphEdge[] = [
      { source: "A", target: "B" },
      { source: "B", target: "C" },
      { source: "C", target: "D" },
    ]

    const degree = degreeCentrality(nodes, edges)
    const betweenness = betweennessCentrality(nodes, edges)

    expect(degree.B).toBeGreaterThan(degree.A)
    expect(betweenness.B).toBeGreaterThan(betweenness.A)
  })

  test("computes directed degree centrality and rejects disconnected prim input", () => {
    const directedEdges: GraphEdge[] = [
      { source: "A", target: "B" },
      { source: "A", target: "C" },
      { source: "C", target: "D" },
    ]
    const disconnectedEdges: GraphEdge[] = [{ source: "A", target: "B", weight: 1 }]

    expect(degreeCentrality(nodes, directedEdges, { direction: "directed" })).toEqual({
      A: 2 / 3,
      B: 0,
      C: 1 / 3,
      D: 0,
    })
    expect(() => prim(nodes.slice(0, 3), disconnectedEdges)).toThrow(
      /connected graph/i
    )
  })

  test("throws on cyclic topological sort input", () => {
    const edges: GraphEdge[] = [
      { source: "A", target: "B" },
      { source: "B", target: "A" },
    ]

    expect(() => topoSort(nodes, edges)).toThrow(/dag/i)
  })

  test("rejects missing start nodes for directed traversals and bellman-ford", () => {
    const edges: GraphEdge[] = [{ source: "A", target: "B" }]

    expect(() => dfs(nodes, edges, "missing", { direction: "directed" })).toThrow(
      /does not exist/i
    )
    expect(() => bellmanFord(nodes, edges, "missing", { direction: "directed" })).toThrow(
      /does not exist/i
    )
  })
})
