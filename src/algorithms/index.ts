import type { GraphDirection, GraphEdge, GraphNode } from "../core/types"

export interface TraversalResult {
  order: string[]
  parents: Record<string, string | null>
  distances: Record<string, number>
  pathTo(targetId: string): string[]
}

export interface ShortestPathResult {
  distances: Record<string, number>
  previous: Record<string, string | null>
  pathTo(targetId: string): string[]
}

function buildAdjacency<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[],
  direction: GraphDirection
) {
  const adjacency = new Map<string, Array<{ id: string; weight: number }>>()
  for (const node of nodes) {
    adjacency.set(node.id, [])
  }
  for (const edge of edges) {
    adjacency.get(edge.source)?.push({
      id: edge.target,
      weight: edge.weight ?? 1,
    })
    if (direction === "undirected") {
      adjacency.get(edge.target)?.push({
        id: edge.source,
        weight: edge.weight ?? 1,
      })
    }
  }
  return adjacency
}

function pathBuilder(parents: Record<string, string | null>) {
  return (targetId: string) => {
    if (!(targetId in parents)) return []
    const path: string[] = []
    let current: string | null = targetId
    while (current) {
      path.push(current)
      current = parents[current] ?? null
    }
    return path.reverse()
  }
}

function ensureStartNodeExists<TNodeData>(
  nodes: GraphNode<TNodeData>[],
  startId: string
) {
  if (!nodes.some((node) => node.id === startId)) {
    throw new Error(`Start node "${startId}" does not exist.`)
  }
}

export function bfs<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[],
  startId: string,
  options: { direction?: GraphDirection } = {}
): TraversalResult {
  ensureStartNodeExists(nodes, startId)
  const adjacency = buildAdjacency(nodes, edges, options.direction ?? "undirected")
  const queue = [startId]
  const order: string[] = []
  const parents: Record<string, string | null> = { [startId]: null }
  const distances: Record<string, number> = { [startId]: 0 }
  const visited = new Set(queue)

  while (queue.length > 0) {
    const current = queue.shift()!
    order.push(current)
    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor.id)) continue
      visited.add(neighbor.id)
      parents[neighbor.id] = current
      distances[neighbor.id] = distances[current] + 1
      queue.push(neighbor.id)
    }
  }

  return {
    order,
    parents,
    distances,
    pathTo: pathBuilder(parents),
  }
}

export function dfs<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[],
  startId: string,
  options: { direction?: GraphDirection } = {}
): TraversalResult {
  ensureStartNodeExists(nodes, startId)
  const adjacency = buildAdjacency(nodes, edges, options.direction ?? "undirected")
  const stack = [startId]
  const order: string[] = []
  const parents: Record<string, string | null> = { [startId]: null }
  const distances: Record<string, number> = { [startId]: 0 }
  const visited = new Set<string>()

  while (stack.length > 0) {
    const current = stack.pop()!
    if (visited.has(current)) continue
    visited.add(current)
    order.push(current)

    const neighbors = adjacency.get(current) ?? []
    for (let index = neighbors.length - 1; index >= 0; index -= 1) {
      const neighbor = neighbors[index]
      if (visited.has(neighbor.id)) continue
      if (!(neighbor.id in parents)) {
        parents[neighbor.id] = current
        distances[neighbor.id] = distances[current] + 1
      }
      stack.push(neighbor.id)
    }
  }

  return {
    order,
    parents,
    distances,
    pathTo: pathBuilder(parents),
  }
}

export function dijkstra<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[],
  startId: string,
  options: { direction?: GraphDirection } = {}
): ShortestPathResult {
  ensureStartNodeExists(nodes, startId)
  const adjacency = buildAdjacency(nodes, edges, options.direction ?? "undirected")
  const distances: Record<string, number> = Object.fromEntries(
    nodes.map((node) => [node.id, Number.POSITIVE_INFINITY])
  )
  const previous: Record<string, string | null> = Object.fromEntries(
    nodes.map((node) => [node.id, null])
  )
  const unvisited = new Set(nodes.map((node) => node.id))
  distances[startId] = 0

  while (unvisited.size > 0) {
    let current: string | null = null
    let currentDistance = Number.POSITIVE_INFINITY
    for (const candidate of unvisited) {
      if (distances[candidate] < currentDistance) {
        current = candidate
        currentDistance = distances[candidate]
      }
    }
    if (!current || currentDistance === Number.POSITIVE_INFINITY) break
    unvisited.delete(current)
    for (const neighbor of adjacency.get(current) ?? []) {
      if (neighbor.weight < 0) {
        throw new Error("Dijkstra does not support negative edge weights.")
      }
      const nextDistance = currentDistance + neighbor.weight
      if (nextDistance < distances[neighbor.id]) {
        distances[neighbor.id] = nextDistance
        previous[neighbor.id] = current
      }
    }
  }

  return {
    distances,
    previous,
    pathTo: pathBuilder(previous),
  }
}

export function bellmanFord<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[],
  startId: string,
  options: { direction?: GraphDirection } = {}
) {
  const direction = options.direction ?? "undirected"
  ensureStartNodeExists(nodes, startId)
  const distances: Record<string, number> = Object.fromEntries(
    nodes.map((node) => [node.id, Number.POSITIVE_INFINITY])
  )
  const previous: Record<string, string | null> = Object.fromEntries(
    nodes.map((node) => [node.id, null])
  )
  distances[startId] = 0

  const allEdges =
    direction === "directed"
      ? edges
      : edges.flatMap((edge) => [
          edge,
          { ...edge, source: edge.target, target: edge.source },
        ])

  for (let round = 0; round < nodes.length - 1; round += 1) {
    let changed = false
    for (const edge of allEdges) {
      if (distances[edge.source] === Number.POSITIVE_INFINITY) continue
      const nextDistance = distances[edge.source] + (edge.weight ?? 1)
      if (nextDistance < distances[edge.target]) {
        distances[edge.target] = nextDistance
        previous[edge.target] = edge.source
        changed = true
      }
    }
    if (!changed) break
  }

  let hasNegativeCycle = false
  for (const edge of allEdges) {
    if (distances[edge.source] === Number.POSITIVE_INFINITY) continue
    if (distances[edge.source] + (edge.weight ?? 1) < distances[edge.target]) {
      hasNegativeCycle = true
      break
    }
  }

  return {
    distances,
    previous,
    hasNegativeCycle,
    pathTo: pathBuilder(previous),
  }
}

export function connectedComponents<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[]
) {
  const adjacency = buildAdjacency(nodes, edges, "undirected")
  const visited = new Set<string>()
  const components: string[][] = []

  for (const node of nodes) {
    if (visited.has(node.id)) continue
    const stack = [node.id]
    const component: string[] = []
    visited.add(node.id)
    while (stack.length > 0) {
      const current = stack.pop()!
      component.push(current)
      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor.id)) continue
        visited.add(neighbor.id)
        stack.push(neighbor.id)
      }
    }
    components.push(component)
  }

  return components
}

export function stronglyConnectedComponents<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[]
) {
  const adjacency = buildAdjacency(nodes, edges, "directed")
  const reverse = buildAdjacency(
    nodes,
    edges.map((edge) => ({
      ...edge,
      source: edge.target,
      target: edge.source,
    })),
    "directed"
  )

  const visited = new Set<string>()
  const order: string[] = []

  function visit(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    for (const neighbor of adjacency.get(id) ?? []) {
      visit(neighbor.id)
    }
    order.push(id)
  }

  nodes.forEach((node) => visit(node.id))
  visited.clear()

  const components: string[][] = []
  while (order.length > 0) {
    const start = order.pop()!
    if (visited.has(start)) continue
    const stack = [start]
    const component: string[] = []
    visited.add(start)
    while (stack.length > 0) {
      const current = stack.pop()!
      component.push(current)
      for (const neighbor of reverse.get(current) ?? []) {
        if (visited.has(neighbor.id)) continue
        visited.add(neighbor.id)
        stack.push(neighbor.id)
      }
    }
    components.push(component)
  }

  return components
}

export function hasCycle<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[],
  options: { direction?: GraphDirection } = {}
) {
  const direction = options.direction ?? "undirected"
  const adjacency = buildAdjacency(nodes, edges, direction)
  const visited = new Set<string>()
  const recursion = new Set<string>()

  function visit(id: string, parent: string | null): boolean {
    visited.add(id)
    recursion.add(id)
    for (const neighbor of adjacency.get(id) ?? []) {
      if (direction === "undirected" && neighbor.id === parent) continue
      if (!visited.has(neighbor.id)) {
        if (visit(neighbor.id, id)) return true
      } else if (direction === "directed" ? recursion.has(neighbor.id) : true) {
        return true
      }
    }
    recursion.delete(id)
    return false
  }

  for (const node of nodes) {
    if (visited.has(node.id)) continue
    if (visit(node.id, null)) return true
  }

  return false
}

export function topoSort<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[],
  options: { method?: "kahn" | "dfs" } = {}
) {
  if (options.method === "dfs") {
    const adjacency = buildAdjacency(nodes, edges, "directed")
    const visited = new Set<string>()
    const recursion = new Set<string>()
    const order: string[] = []

    function visit(id: string) {
      if (recursion.has(id)) {
        throw new Error("Topological sort is only defined for DAGs.")
      }
      if (visited.has(id)) return
      visited.add(id)
      recursion.add(id)
      for (const neighbor of adjacency.get(id) ?? []) {
        visit(neighbor.id)
      }
      recursion.delete(id)
      order.push(id)
    }

    nodes.forEach((node) => visit(node.id))
    return order.reverse()
  }

  const adjacency = buildAdjacency(nodes, edges, "directed")
  const indegree = new Map(nodes.map((node) => [node.id, 0]))
  for (const edge of edges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1)
  }
  const queue = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id)
  const order: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    order.push(current)
    for (const neighbor of adjacency.get(current) ?? []) {
      const next = (indegree.get(neighbor.id) ?? 0) - 1
      indegree.set(neighbor.id, next)
      if (next === 0) {
        queue.push(neighbor.id)
      }
    }
  }

  if (order.length !== nodes.length) {
    throw new Error("Topological sort is only defined for DAGs.")
  }

  return order
}

class DisjointSet {
  private parent = new Map<string, string>()
  private rank = new Map<string, number>()

  constructor(ids: string[]) {
    ids.forEach((id) => {
      this.parent.set(id, id)
      this.rank.set(id, 0)
    })
  }

  find(id: string): string {
    const parent = this.parent.get(id)
    if (!parent || parent === id) return id
    const root = this.find(parent)
    this.parent.set(id, root)
    return root
  }

  union(left: string, right: string) {
    const leftRoot = this.find(left)
    const rightRoot = this.find(right)
    if (leftRoot === rightRoot) return false
    const leftRank = this.rank.get(leftRoot) ?? 0
    const rightRank = this.rank.get(rightRoot) ?? 0
    if (leftRank < rightRank) {
      this.parent.set(leftRoot, rightRoot)
    } else if (leftRank > rightRank) {
      this.parent.set(rightRoot, leftRoot)
    } else {
      this.parent.set(rightRoot, leftRoot)
      this.rank.set(leftRoot, leftRank + 1)
    }
    return true
  }
}

export function kruskal<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[]
) {
  const disjointSet = new DisjointSet(nodes.map((node) => node.id))
  const sorted = [...edges].sort((left, right) => (left.weight ?? 1) - (right.weight ?? 1))
  const tree: GraphEdge<TEdgeData>[] = []
  let totalWeight = 0

  for (const edge of sorted) {
    if (!disjointSet.union(edge.source, edge.target)) continue
    tree.push(edge)
    totalWeight += edge.weight ?? 1
  }

  return {
    edges: tree,
    totalWeight,
  }
}

export function prim<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[]
) {
  if (nodes.length === 0) {
    return { edges: [] as GraphEdge<TEdgeData>[], totalWeight: 0 }
  }
  const visited = new Set<string>([nodes[0].id])
  const tree: GraphEdge<TEdgeData>[] = []
  let totalWeight = 0

  while (visited.size < nodes.length) {
    let bestEdge: GraphEdge<TEdgeData> | null = null
    for (const edge of edges) {
      const entersTree =
        (visited.has(edge.source) && !visited.has(edge.target)) ||
        (visited.has(edge.target) && !visited.has(edge.source))
      if (!entersTree) continue
      if (!bestEdge || (edge.weight ?? 1) < (bestEdge.weight ?? 1)) {
        bestEdge = edge
      }
    }
    if (!bestEdge) break
    tree.push(bestEdge)
    totalWeight += bestEdge.weight ?? 1
    visited.add(bestEdge.source)
    visited.add(bestEdge.target)
  }

  if (visited.size !== nodes.length) {
    throw new Error("Prim requires a connected graph.")
  }

  return {
    edges: tree,
    totalWeight,
  }
}

export function degreeCentrality<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[],
  options: { direction?: GraphDirection } = {}
) {
  const direction = options.direction ?? "undirected"
  const totals: Record<string, number> = Object.fromEntries(nodes.map((node) => [node.id, 0]))
  for (const edge of edges) {
    totals[edge.source] += 1
    if (direction === "undirected") {
      totals[edge.target] += 1
    }
  }
  const normalizer = Math.max(1, nodes.length - 1)
  return Object.fromEntries(
    Object.entries(totals).map(([id, value]) => [id, value / normalizer])
  )
}

export function betweennessCentrality<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[],
  options: { direction?: GraphDirection } = {}
) {
  const direction = options.direction ?? "undirected"
  const adjacency = buildAdjacency(nodes, edges, direction)
  const centrality: Record<string, number> = Object.fromEntries(
    nodes.map((node) => [node.id, 0])
  )

  for (const source of nodes.map((node) => node.id)) {
    const stack: string[] = []
    const predecessors = new Map<string, string[]>()
    const sigma = new Map<string, number>()
    const distance = new Map<string, number>()
    const queue: string[] = [source]

    for (const node of nodes.map((entry) => entry.id)) {
      predecessors.set(node, [])
      sigma.set(node, 0)
      distance.set(node, -1)
    }

    sigma.set(source, 1)
    distance.set(source, 0)

    while (queue.length > 0) {
      const current = queue.shift()!
      stack.push(current)
      for (const neighbor of adjacency.get(current) ?? []) {
        if ((distance.get(neighbor.id) ?? -1) < 0) {
          queue.push(neighbor.id)
          distance.set(neighbor.id, (distance.get(current) ?? 0) + 1)
        }
        if (distance.get(neighbor.id) === (distance.get(current) ?? 0) + 1) {
          sigma.set(neighbor.id, (sigma.get(neighbor.id) ?? 0) + (sigma.get(current) ?? 0))
          predecessors.get(neighbor.id)?.push(current)
        }
      }
    }

    const dependency = new Map<string, number>(nodes.map((node) => [node.id, 0]))
    while (stack.length > 0) {
      const current = stack.pop()!
      for (const predecessor of predecessors.get(current) ?? []) {
        const ratio = (sigma.get(predecessor) ?? 0) / Math.max(1, sigma.get(current) ?? 1)
        dependency.set(
          predecessor,
          (dependency.get(predecessor) ?? 0) +
            ratio * (1 + (dependency.get(current) ?? 0))
        )
      }
      if (current !== source) {
        centrality[current] += dependency.get(current) ?? 0
      }
    }
  }

  if (direction === "undirected") {
    for (const key of Object.keys(centrality)) {
      centrality[key] /= 2
    }
  }

  return centrality
}
