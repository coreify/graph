import type {
  GraphDirection,
  GraphEdge,
  GraphNode,
  GraphState,
  ShareableGraphState,
} from "../core/types"

function toBase64(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64")
  }
  if (typeof btoa !== "undefined") {
    return btoa(value)
  }
  throw new Error("Base64 encoding is not available in this environment.")
}

function fromBase64(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64").toString("utf8")
  }
  if (typeof atob !== "undefined") {
    return atob(value)
  }
  throw new Error("Base64 decoding is not available in this environment.")
}

function toBase64Url(value: string) {
  return toBase64(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function fromBase64Url(value: string) {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4)
  return fromBase64(padded)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function escapeQuotedText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
}

function isValidNode(node: unknown): node is GraphNode<unknown> {
  if (!isRecord(node)) return false
  return (
    typeof node.id === "string" &&
    typeof node.label === "string" &&
    isFiniteNumber(node.x) &&
    isFiniteNumber(node.y) &&
    isFiniteNumber(node.vx) &&
    isFiniteNumber(node.vy) &&
    typeof node.fixed === "boolean"
  )
}

function isValidEdge(edge: unknown): edge is GraphEdge<unknown> {
  if (!isRecord(edge)) return false
  return (
    typeof edge.source === "string" &&
    typeof edge.target === "string" &&
    (edge.weight === undefined || isFiniteNumber(edge.weight)) &&
    (edge.label === undefined || typeof edge.label === "string")
  )
}

export function isShareableGraphState<TNodeData = unknown, TEdgeData = unknown>(
  value: unknown
): value is ShareableGraphState<TNodeData, TEdgeData> {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  const canvasSize = candidate.canvasSize
  const canvasSizeValid = canvasSize === undefined || isRecord(canvasSize)
  return (
    Array.isArray(candidate.nodes) &&
    candidate.nodes.every(isValidNode) &&
    Array.isArray(candidate.edges) &&
    candidate.edges.every(isValidEdge) &&
    (candidate.direction === "undirected" || candidate.direction === "directed") &&
    (candidate.indexMode === "0-index" ||
      candidate.indexMode === "1-index" ||
      candidate.indexMode === "custom") &&
    isPlainObject(candidate.config) &&
    isPlainObject(candidate.customLabels) &&
    canvasSizeValid
  )
}

export function serialize<TNodeData = unknown, TEdgeData = unknown>(
  state: ShareableGraphState<TNodeData, TEdgeData>
) {
  return JSON.stringify(state)
}

export function deserialize<TNodeData = unknown, TEdgeData = unknown>(value: string) {
  const parsed = JSON.parse(value) as unknown
  if (!isShareableGraphState<TNodeData, TEdgeData>(parsed)) {
    throw new Error("Invalid graph state payload.")
  }
  const candidate = parsed as ShareableGraphState<TNodeData, TEdgeData>
  const canvasSize =
    candidate.canvasSize && isRecord(candidate.canvasSize)
      ? {
          width:
            typeof candidate.canvasSize.width === "number" &&
            Number.isFinite(candidate.canvasSize.width) &&
            candidate.canvasSize.width >= 0
              ? candidate.canvasSize.width
              : 800,
          height:
            typeof candidate.canvasSize.height === "number" &&
            Number.isFinite(candidate.canvasSize.height) &&
            candidate.canvasSize.height >= 0
              ? candidate.canvasSize.height
              : 600,
        }
      : { width: 800, height: 600 }
  const state: GraphState<TNodeData, TEdgeData> = {
    nodes: candidate.nodes.map((node) => ({ ...node })),
    edges: candidate.edges.map((edge) => ({ ...edge })),
    direction: candidate.direction,
    indexMode: candidate.indexMode,
    config: { ...candidate.config },
    customLabels: { ...candidate.customLabels },
    canvasSize,
  }
  return state
}

export function encodeGraphStateForShare<TNodeData = unknown, TEdgeData = unknown>(
  state: ShareableGraphState<TNodeData, TEdgeData>
) {
  return toBase64Url(serialize(state))
}

export function decodeGraphStateFromShare<TNodeData = unknown, TEdgeData = unknown>(
  value: string
) {
  return deserialize<TNodeData, TEdgeData>(fromBase64Url(value))
}

export function toAdjacencyList<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[],
  options?: { direction?: GraphDirection; weighted?: false }
): Map<string, string[]>
export function toAdjacencyList<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[],
  options: { direction?: GraphDirection; weighted: true }
): Map<string, Array<{ id: string; weight: number }>>
export function toAdjacencyList<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[],
  options: { direction?: GraphDirection; weighted?: boolean } = {}
) {
  const direction = options.direction ?? "undirected"
  const adjacency = new Map<string, string[] | Array<{ id: string; weight: number }>>()

  for (const node of nodes) {
    adjacency.set(node.id, [])
  }
  for (const edge of edges) {
    const value = options.weighted
      ? { id: edge.target, weight: edge.weight ?? 1 }
      : edge.target
    ;(adjacency.get(edge.source) as Array<typeof value>)?.push(value)
    if (direction === "undirected") {
      const reverse = options.weighted
        ? { id: edge.source, weight: edge.weight ?? 1 }
        : edge.source
      ;(adjacency.get(edge.target) as Array<typeof reverse>)?.push(reverse)
    }
  }

  return adjacency
}

export function toAdjacencyMatrix<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[],
  options?: { direction?: GraphDirection; weighted?: false }
): number[][]
export function toAdjacencyMatrix<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[],
  options: { direction?: GraphDirection; weighted?: boolean } = {}
) {
  const direction = options.direction ?? "undirected"
  const indexById = new Map(nodes.map((node, index) => [node.id, index]))
  const matrix = Array.from({ length: nodes.length }, () =>
    Array.from({ length: nodes.length }, () => 0)
  )

  for (const edge of edges) {
    const source = indexById.get(edge.source)
    const target = indexById.get(edge.target)
    if (source === undefined || target === undefined) continue
    matrix[source][target] = options.weighted ? edge.weight ?? 1 : 1
    if (direction === "undirected") {
      matrix[target][source] = options.weighted ? edge.weight ?? 1 : 1
    }
  }

  return matrix
}

export function toDOT<TNodeData, TEdgeData>(
  nodes: GraphNode<TNodeData>[],
  edges: GraphEdge<TEdgeData>[],
  options: { directed?: boolean; graphName?: string } = {}
) {
  const directed = options.directed ?? false
  const connector = directed ? "->" : "--"
  const lines = [
    `${directed ? "digraph" : "graph"} ${
      options.graphName ? `"${escapeQuotedText(options.graphName)}"` : "G"
    } {`,
  ]

  for (const node of nodes) {
    lines.push(`  "${escapeQuotedText(node.id)}" [label="${escapeQuotedText(node.label)}"];`)
  }

  for (const edge of edges) {
    const attributes: string[] = []
    if (typeof edge.weight === "number") {
      attributes.push(`weight=${edge.weight}`)
    }
    if (edge.label) {
      attributes.push(`label="${escapeQuotedText(edge.label)}"`)
    }
    lines.push(
      `  "${escapeQuotedText(edge.source)}" ${connector} "${escapeQuotedText(edge.target)}"${
        attributes.length > 0 ? ` [${attributes.join(", ")}]` : ""
      };`
    )
  }

  lines.push("}")
  return lines.join("\n")
}
