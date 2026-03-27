import type { GraphCanvasSize, GraphConfig } from "./types"

export const DEFAULT_CONFIG: GraphConfig = {
  nodeRadius: 19,
  edgeIdealLength: 140,
  nodeBackground: "#ffffff",
  nodeColor: "#111827",
  edgeColor: "#374151",
  labelColor: "#111827",
  nodeLabelFontSize: 16,
  edgeLabelFontSize: 18,
}

export const DEFAULT_CANVAS_SIZE: GraphCanvasSize = {
  width: 800,
  height: 600,
}

export const DEFAULT_HISTORY_LIMIT = 200
