export interface GraphNode<TData = unknown> {
  id: string
  label: string
  x: number
  y: number
  vx: number
  vy: number
  fixed: boolean
  data?: TData
}

export interface GraphEdge<TData = unknown> {
  source: string
  target: string
  weight?: number
  label?: string
  data?: TData
}

export type GraphDirection = "undirected" | "directed"
export type GraphIndexMode = "0-index" | "1-index" | "custom"
export type LayoutAlgorithm = "circular" | "grid" | "layered"

export interface GraphConfig {
  nodeRadius: number
  edgeIdealLength: number
  nodeBackground: string
  nodeColor: string
  edgeColor: string
  labelColor: string
  nodeLabelFontSize: number
  edgeLabelFontSize: number
}

export interface GraphCanvasSize {
  width: number
  height: number
}

export interface GraphState<TNodeData = unknown, TEdgeData = unknown> {
  nodes: GraphNode<TNodeData>[]
  edges: GraphEdge<TEdgeData>[]
  direction: GraphDirection
  indexMode: GraphIndexMode
  config: GraphConfig
  customLabels: Record<string, string>
  canvasSize: GraphCanvasSize
}

export type ShareableGraphState<TNodeData = unknown, TEdgeData = unknown> = Pick<
  GraphState<TNodeData, TEdgeData>,
  "nodes" | "edges" | "direction" | "indexMode" | "config" | "customLabels"
> & {
  canvasSize?: GraphCanvasSize
}

export type GraphStoreListener = () => void
export type GraphMutationOptions = { recordHistory?: boolean }

export interface GraphSnapshot<TNodeData = unknown, TEdgeData = unknown> {
  nodes: GraphNode<TNodeData>[]
  edges: GraphEdge<TEdgeData>[]
  direction: GraphDirection
  indexMode: GraphIndexMode
  config: GraphConfig
  customLabels: Record<string, string>
  canvasSize: GraphCanvasSize
}

export interface ParsedGraph<TNodeData = unknown, TEdgeData = unknown> {
  nodes: GraphNode<TNodeData>[]
  edges: GraphEdge<TEdgeData>[]
  customLabels: Record<string, string>
  format: "indexed" | "named"
}

export interface ValidationIssue {
  line: number
  message: string
}

export type ParseGraphResult<TNodeData = unknown, TEdgeData = unknown> =
  | {
      ok: true
      value: ParsedGraph<TNodeData, TEdgeData>
    }
  | {
      ok: false
      issues: ValidationIssue[]
    }

export interface GraphStoreEventMap<
  TNodeData = unknown,
  TEdgeData = unknown,
> {
  "state:change": GraphState<TNodeData, TEdgeData>
  "node:add": GraphNode<TNodeData>
  "node:update": GraphNode<TNodeData>
  "node:remove": GraphNode<TNodeData>
  "edge:add": GraphEdge<TEdgeData>
  "edge:update": GraphEdge<TEdgeData>
  "edge:remove": GraphEdge<TEdgeData>
  "layout:change": {
    algorithm: LayoutAlgorithm
    nodes: GraphNode<TNodeData>[]
  }
  "history:undo": GraphSnapshot<TNodeData, TEdgeData>
  "history:redo": GraphSnapshot<TNodeData, TEdgeData>
  "parse:error": ValidationIssue[]
  "parse:success": ParsedGraph<TNodeData, TEdgeData>
  clear: GraphState<TNodeData, TEdgeData>
}

export interface QTCell {
  x0: number
  y0: number
  x1: number
  y1: number
  cx: number
  cy: number
  mass: number
  bodyIdx: number
  children: (QTCell | null)[]
}
