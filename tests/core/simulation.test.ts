import { createInlineSimulation, ForceSimulation } from "../../src/core"
import type { GraphEdge, GraphNode } from "../../src/core"

const nodes: GraphNode[] = [
  { id: "0", label: "0", x: 10, y: 10, vx: 0, vy: 0, fixed: false },
  { id: "1", label: "1", x: 20, y: 20, vx: 0, vy: 0, fixed: false },
]

const edges: GraphEdge[] = [{ source: "0", target: "1", weight: 1 }]

describe("ForceSimulation", () => {
  test("syncs nodes and edges and writes positions back", () => {
    const simulation = new ForceSimulation()
    simulation.syncNodes(nodes)
    simulation.syncEdges(edges)
    simulation.setCenter(100, 100)
    simulation.setIdealLength(80)
    simulation.setPosition(0, 40, 50)
    simulation.setFixed(1, true)

    expect(simulation.indexOfId("0")).toBe(0)
    expect(simulation.tick()).toBe(true)

    const updated = simulation.writeBack(nodes)
    expect(updated[0].x).toBeGreaterThan(0)
    expect(updated[1].fixed).toBe(true)
  })

  test("mergeSyncNodes preserves prior positions for matching ids", () => {
    const simulation = new ForceSimulation()
    simulation.syncNodes(nodes)
    simulation.setPosition(0, 200, 150)

    simulation.mergeSyncNodes([
      { id: "0", label: "0", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
      { id: "1", label: "1", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
    ])

    expect(simulation.x[0]).toBe(200)
    expect(simulation.y[0]).toBe(150)
  })

  test("tracks node labels and exposes inline simulation from core", () => {
    const simulation = new ForceSimulation()
    simulation.syncNodes(nodes)

    expect(simulation.nodeLabels).toEqual(["0", "1"])

    const inline = createInlineSimulation()
    inline.sync(nodes, edges, { centerX: 100, centerY: 100, idealLength: 80 })
    const result = inline.tick()

    expect(result.nodes).toHaveLength(2)
    expect(typeof result.running).toBe("boolean")
  })
})
