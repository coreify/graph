import { clamp } from "./helpers/validation"
import type {
  GraphCanvasSize,
  GraphDirection,
  GraphEdge,
  GraphNode,
  LayoutAlgorithm,
} from "./types"

export interface LayoutOptions {
  canvasSize?: GraphCanvasSize
  nodeRadius?: number
  direction?: GraphDirection
  margin?: number
}

type GenericNode = GraphNode<unknown>
type GenericEdge = GraphEdge<unknown>

function getBounds(options: LayoutOptions) {
  const canvasSize = options.canvasSize ?? { width: 800, height: 600 }
  const margin = options.margin ?? (options.nodeRadius ?? 19) + 16
  const minX = margin
  const minY = margin
  const maxX = Math.max(minX, canvasSize.width - margin)
  const maxY = Math.max(minY, canvasSize.height - margin)

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

function resetNode<TData>(node: GraphNode<TData>, x: number, y: number) {
  return {
    ...node,
    x,
    y,
    fixed: true,
    vx: 0,
    vy: 0,
  }
}

export function arrangeCircular<TData>(
  nodes: GraphNode<TData>[],
  options: LayoutOptions = {}
): GraphNode<TData>[] {
  if (nodes.length === 0) return []
  const bounds = getBounds(options)
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  const radius = Math.max(
    (options.nodeRadius ?? 19) * 1.5,
    Math.min(bounds.width, bounds.height) / 2
  )

  return nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2
    const x = clamp(cx + radius * Math.cos(angle), bounds.minX, bounds.maxX)
    const y = clamp(cy + radius * Math.sin(angle), bounds.minY, bounds.maxY)
    return resetNode(node, x, y)
  })
}

export function arrangeGrid<TData>(
  nodes: GraphNode<TData>[],
  options: LayoutOptions = {}
): GraphNode<TData>[] {
  if (nodes.length === 0) return []
  const bounds = getBounds(options)
  const cols = Math.ceil(Math.sqrt(nodes.length))
  const rows = Math.ceil(nodes.length / cols)
  const stepX = cols > 1 ? bounds.width / (cols - 1) : 0
  const stepY = rows > 1 ? bounds.height / (rows - 1) : 0

  return nodes.map((node, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    return resetNode(node, bounds.minX + col * stepX, bounds.minY + row * stepY)
  })
}

export function arrangeLayered<TData, EData>(
  nodes: GraphNode<TData>[],
  edges: GraphEdge<EData>[],
  options: LayoutOptions = {}
): GraphNode<TData>[] {
  if (nodes.length === 0) return []
  const bounds = getBounds(options)
  const direction = options.direction ?? "undirected"
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const adjacency = new Map<string, string[]>()
  const indegree = new Map<string, number>()

  for (const node of nodes) {
    adjacency.set(node.id, [])
    indegree.set(node.id, 0)
  }

  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target)
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1)
    if (direction === "undirected") {
      adjacency.get(edge.target)?.push(edge.source)
      indegree.set(edge.source, (indegree.get(edge.source) ?? 0) + 1)
    }
  }

  const visited = new Set<string>()
  const levels = new Map<string, number>()
  const queue: string[] = []

  const roots = nodes
    .map((node) => node.id)
    .filter((id) => (indegree.get(id) ?? 0) === 0)

  for (const root of roots.length > 0 ? roots : [nodes[0].id]) {
    if (visited.has(root)) continue
    visited.add(root)
    levels.set(root, 0)
    queue.push(root)
    while (queue.length > 0) {
      const current = queue.shift()!
      const nextLevel = (levels.get(current) ?? 0) + 1
      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        levels.set(neighbor, nextLevel)
        queue.push(neighbor)
      }
    }
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      levels.set(node.id, 0)
    }
  }

  const buckets = new Map<number, string[]>()
  for (const [id, level] of levels.entries()) {
    const list = buckets.get(level) ?? []
    list.push(id)
    buckets.set(level, list)
  }

  const maxLevel = Math.max(...buckets.keys())
  const yStep = maxLevel > 0 ? bounds.height / maxLevel : 0
  const positioned = new Map<string, GraphNode<TData>>()

  for (let level = 0; level <= maxLevel; level += 1) {
    const ids = buckets.get(level) ?? []
    const xStep = bounds.width / (ids.length + 1)
    ids.forEach((id, index) => {
      const node = nodeMap.get(id)
      if (!node) return
      positioned.set(
        id,
        resetNode(node, bounds.minX + xStep * (index + 1), bounds.minY + level * yStep)
      )
    })
  }

  return nodes.map((node) => positioned.get(node.id) ?? node)
}

export function applyLayout<TData, EData>(
  algorithm: LayoutAlgorithm,
  nodes: GraphNode<TData>[],
  edges: GraphEdge<EData>[],
  options: LayoutOptions = {}
): GraphNode<TData>[] {
  switch (algorithm) {
    case "circular":
      return arrangeCircular(nodes, options)
    case "grid":
      return arrangeGrid(nodes, options)
    case "layered":
      return arrangeLayered(nodes, edges, options)
  }
}

export function getEdgeKey(
  source: string,
  target: string,
  direction: GraphDirection
) {
  if (direction === "directed") {
    return `${source}->${target}`
  }
  return source < target ? `${source}--${target}` : `${target}--${source}`
}

export type { GenericEdge, GenericNode }
