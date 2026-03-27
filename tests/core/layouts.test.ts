import {
  applyLayout,
  arrangeCircular,
  arrangeGrid,
  arrangeLayered,
} from "../../src/core"
import type { GraphEdge, GraphNode } from "../../src/core"

const nodes: GraphNode[] = [
  { id: "0", label: "0", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
  { id: "1", label: "1", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
  { id: "2", label: "2", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
  { id: "3", label: "3", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
]

const edges: GraphEdge[] = [
  { source: "0", target: "1" },
  { source: "1", target: "2" },
  { source: "1", target: "3" },
]

describe("layouts", () => {
  test("arrangeCircular fixes nodes inside the provided canvas", () => {
    const arranged = arrangeCircular(nodes, { canvasSize: { width: 600, height: 400 } })
    expect(arranged.every((node) => node.fixed)).toBe(true)
    expect(arranged.every((node) => node.x >= 0 && node.x <= 600)).toBe(true)
    expect(arranged.every((node) => node.y >= 0 && node.y <= 400)).toBe(true)
  })

  test("arrangeGrid places nodes on a grid", () => {
    const arranged = arrangeGrid(nodes, { canvasSize: { width: 600, height: 400 } })
    expect(new Set(arranged.map((node) => `${node.x}:${node.y}`)).size).toBe(4)
  })

  test("arrangeLayered places roots above descendants", () => {
    const arranged = arrangeLayered(nodes, edges, {
      canvasSize: { width: 600, height: 400 },
      direction: "directed",
    })

    const top = arranged.find((node) => node.id === "0")!
    const child = arranged.find((node) => node.id === "2")!

    expect(top.y).toBeLessThan(child.y)
  })

  test("applyLayout dispatches the requested algorithm", () => {
    const arranged = applyLayout("grid", nodes, edges, {
      canvasSize: { width: 600, height: 400 },
    })
    expect(arranged).toHaveLength(4)
  })
})
