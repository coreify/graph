import { DEFAULT_CANVAS_SIZE, DEFAULT_CONFIG } from "./constants"
import { parseInteger, parseNumber } from "./helpers/validation"
import { getEdgeKey } from "./layouts"
import type {
  GraphDirection,
  GraphEdge,
  GraphIndexMode,
  GraphNode,
  GraphState,
  ParseGraphResult,
  ParsedGraph,
  ValidationIssue,
} from "./types"

export interface ParseGraphTextOptions<TNodeData = unknown> {
  indexMode?: GraphIndexMode
  direction?: GraphDirection
  existingNodes?: GraphNode<TNodeData>[]
  customLabels?: Record<string, string>
  canvasSize?: GraphState<TNodeData, unknown>["canvasSize"]
  nodeRadius?: number
  random?: () => number
}

export interface GenerateGraphTextOptions {
  preferNamedFormat?: boolean
}

function stripComments(line: string) {
  let quote: string | null = null
  let escaped = false
  let result = ""

  for (const character of line) {
    if (escaped) {
      result += character
      escaped = false
      continue
    }
    if (character === "\\") {
      result += character
      escaped = true
      continue
    }
    if (quote) {
      if (character === quote) quote = null
      result += character
      continue
    }
    if (character === "'" || character === "\"") {
      quote = character
      result += character
      continue
    }
    if (character === "#") {
      break
    }
    result += character
  }

  return result.trim()
}

function unescapeQuotedToken(token: string) {
  let result = ""
  let escaped = false

  for (const character of token) {
    if (escaped) {
      switch (character) {
        case "n":
          result += "\n"
          break
        case "r":
          result += "\r"
          break
        case "t":
          result += "\t"
          break
        case "\\":
          result += "\\"
          break
        case "\"":
          result += "\""
          break
        case "'":
          result += "'"
          break
        default:
          result += character
          break
      }
      escaped = false
      continue
    }
    if (character === "\\") {
      escaped = true
      continue
    }
    result += character
  }

  return result
}

function tokenize(line: string) {
  return Array.from(line.matchAll(/->|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\S+/g)).map(
    (match) => {
      const token = match[0]
      if (
        (token.startsWith("\"") && token.endsWith("\"")) ||
        (token.startsWith("'") && token.endsWith("'"))
      ) {
        return unescapeQuotedToken(token.slice(1, -1))
      }
      return token
    }
  )
}

function getRandomPosition(
  options: ParseGraphTextOptions<unknown>,
  index: number
) {
  const random = options.random ?? Math.random
  const canvasSize = options.canvasSize ?? DEFAULT_CANVAS_SIZE
  const radius = options.nodeRadius ?? DEFAULT_CONFIG.nodeRadius
  const margin = radius + 16
  const minX = margin
  const minY = margin
  const maxX = Math.max(minX, canvasSize.width - margin)
  const maxY = Math.max(minY, canvasSize.height - margin)
  const x = minX + (maxX - minX) * random()
  const y = minY + (maxY - minY) * random()

  return {
    x: Number.isFinite(x) ? x : 120 + index * 20,
    y: Number.isFinite(y) ? y : 120 + index * 20,
  }
}

function buildNode<TNodeData>(
  id: string,
  label: string,
  index: number,
  options: ParseGraphTextOptions<TNodeData>
): GraphNode<TNodeData> {
  const existing = options.existingNodes?.find((node) => node.id === id)
  if (existing) {
    return {
      ...existing,
      label,
    }
  }

  const position = getRandomPosition(options as ParseGraphTextOptions<unknown>, index)
  return {
    id,
    label,
    x: position.x,
    y: position.y,
    vx: 0,
    vy: 0,
    fixed: false,
  }
}

function parseEdgeMetadata(tokens: string[], startIndex: number) {
  const weight = parseNumber(tokens[startIndex] ?? "")
  const labelIndex = weight === null ? startIndex : startIndex + 1
  const label = tokens.slice(labelIndex).join(" ").trim()

  return {
    weight: weight ?? undefined,
    label: label || undefined,
  }
}

function normalizeNodeToken(token: string) {
  return token
}

function buildSuccess<TNodeData, TEdgeData>(
  value: ParsedGraph<TNodeData, TEdgeData>
): ParseGraphResult<TNodeData, TEdgeData> {
  return { ok: true, value }
}

function buildFailure<TNodeData, TEdgeData>(
  issues: ValidationIssue[]
): ParseGraphResult<TNodeData, TEdgeData> {
  return { ok: false, issues }
}

export function parseGraphText<TNodeData = unknown, TEdgeData = unknown>(
  text: string,
  options: ParseGraphTextOptions<TNodeData> = {}
): ParseGraphResult<TNodeData, TEdgeData> {
  const direction = options.direction ?? "undirected"
  const rawLines = text.split("\n")
  const lines = rawLines
    .map((raw, index) => ({
      line: index + 1,
      value: stripComments(raw),
    }))
    .filter((entry) => entry.value.length > 0)

  if (lines.length === 0) {
    return buildSuccess({
      nodes: [],
      edges: [],
      customLabels: {},
      format: "indexed",
    })
  }

  const issues: ValidationIssue[] = []
  const firstTokens = tokenize(lines[0].value)
  const declaredCount = firstTokens.length === 1 ? parseInteger(firstTokens[0]) : null

  if (declaredCount !== null) {
    if (declaredCount < 0) {
      return buildFailure([{ line: lines[0].line, message: "Node count must be >= 0." }])
    }

    const indexMode = options.indexMode ?? "0-index"
    const offset = indexMode === "1-index" ? 1 : 0
    const customLabels = { ...(options.customLabels ?? {}) }
    const nodes = Array.from({ length: declaredCount }, (_, index) => {
      const id = String(index)
      const label =
        indexMode === "custom" ? customLabels[id] ?? String(index) : String(index + offset)
      return buildNode(id, label, index, options)
    })

    const edges: GraphEdge<TEdgeData>[] = []
    const seen = new Set<string>()

    for (const entry of lines.slice(1)) {
      const tokens = tokenize(entry.value)
      if (tokens.length === 1) {
        const isolatedNode = parseInteger(tokens[0])
        if (isolatedNode === null) {
          issues.push({
            line: entry.line,
            message: "Expected a node declaration or edge declaration.",
          })
          continue
        }
        const normalized = indexMode === "1-index" ? isolatedNode - 1 : isolatedNode
        if (normalized < 0 || normalized >= declaredCount) {
          issues.push({
            line: entry.line,
            message: `Node ${tokens[0]} is outside the declared node count.`,
          })
        }
        continue
      }

      if (tokens.length < 2) {
        issues.push({
          line: entry.line,
          message: "Edge declarations must contain at least source and target nodes.",
        })
        continue
      }

      let source = parseInteger(tokens[0])
      let target = parseInteger(tokens[1])
      if (source === null || target === null) {
        issues.push({
          line: entry.line,
          message: "Indexed graph format expects integer source and target nodes.",
        })
        continue
      }

      if (indexMode === "1-index") {
        source -= 1
        target -= 1
      }

      if (source < 0 || source >= declaredCount || target < 0 || target >= declaredCount) {
        issues.push({
          line: entry.line,
          message: "Edge references a node outside the declared node count.",
        })
        continue
      }

      if (source === target) {
        issues.push({
          line: entry.line,
          message: "Self-loops are not supported by the text parser.",
        })
        continue
      }

      const key = getEdgeKey(String(source), String(target), direction)
      if (seen.has(key)) continue
      seen.add(key)
      const metadata = parseEdgeMetadata(tokens, 2)
      edges.push({
        source: String(source),
        target: String(target),
        ...(metadata.weight === undefined ? {} : { weight: metadata.weight }),
        ...(metadata.label ? { label: metadata.label } : {}),
      })
    }

    if (issues.length > 0) return buildFailure(issues)
    return buildSuccess({
      nodes,
      edges,
      customLabels,
      format: "indexed",
    })
  }

  const nodesById = new Map<string, GraphNode<TNodeData>>()
  const edges: GraphEdge<TEdgeData>[] = []
  const seen = new Set<string>()

  for (const entry of lines) {
    const tokens = tokenize(entry.value)
    if (tokens.length === 0) continue

    if (tokens.length === 1) {
      const id = normalizeNodeToken(tokens[0]).trim()
      if (!id) {
        issues.push({ line: entry.line, message: "Node name cannot be empty." })
        continue
      }
      if (!nodesById.has(id)) {
        nodesById.set(id, buildNode(id, id, nodesById.size, options))
      }
      continue
    }

    if (tokens.length >= 3 && tokens[1] === "->") {
      const source = normalizeNodeToken(tokens[0]).trim()
      const target = normalizeNodeToken(tokens[2]).trim()
      if (!source || !target) {
        issues.push({
          line: entry.line,
          message: "Named edge declarations require both source and target node names.",
        })
        continue
      }
      if (source === target) {
        issues.push({ line: entry.line, message: "Self-loops are not supported by the text parser." })
        continue
      }
      if (!nodesById.has(source)) {
        nodesById.set(source, buildNode(source, source, nodesById.size, options))
      }
      if (!nodesById.has(target)) {
        nodesById.set(target, buildNode(target, target, nodesById.size, options))
      }

      const key = getEdgeKey(source, target, direction)
      if (seen.has(key)) continue
      seen.add(key)
      const metadata = parseEdgeMetadata(tokens, 3)
      edges.push({
        source,
        target,
        ...(metadata.weight === undefined ? {} : { weight: metadata.weight }),
        ...(metadata.label ? { label: metadata.label } : {}),
      })
      continue
    }

    issues.push({
      line: entry.line,
      message: "Named graph format expects `node` lines or `source -> target` edges.",
    })
  }

  if (issues.length > 0) return buildFailure(issues)
  return buildSuccess({
    nodes: Array.from(nodesById.values()),
    edges,
    customLabels: {},
    format: "named",
  })
}

function escapeQuotedText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
}

function quoteIfNeeded(value: string) {
  if (value.length === 0 || /[\s#"\\]/.test(value)) {
    return `"${escapeQuotedText(value)}"`
  }
  return value
}

function isNumericId(id: string) {
  return id === "0" || /^[1-9]\d*$/.test(id)
}

function canUseIndexedFormat<TNodeData, TEdgeData>(
  state: Pick<GraphState<TNodeData, TEdgeData>, "nodes" | "indexMode">
) {
  if (state.indexMode === "custom") return false
  const offset = state.indexMode === "1-index" ? 1 : 0
  if (!state.nodes.every((node) => isNumericId(node.id))) return false
  const expected = new Set(state.nodes.map((_, index) => String(index + offset)))
  return state.nodes.length === expected.size && state.nodes.every((node) => expected.has(node.id))
}

export function generateGraphText<TNodeData, TEdgeData>(
  state: Pick<
    GraphState<TNodeData, TEdgeData>,
    "nodes" | "edges" | "indexMode" | "customLabels"
  >,
  options: GenerateGraphTextOptions = {}
) {
  if (options.preferNamedFormat || !canUseIndexedFormat(state)) {
    const lines: string[] = []
    for (const node of state.nodes) {
      lines.push(`"${escapeQuotedText(node.id)}"`)
    }
    for (const edge of state.edges) {
      const parts = [
        `"${escapeQuotedText(edge.source)}"`,
        "->",
        `"${escapeQuotedText(edge.target)}"`,
      ]
      if (typeof edge.weight === "number" && Number.isFinite(edge.weight)) {
        parts.push(String(edge.weight))
      }
      if (edge.label?.trim()) {
        parts.push(quoteIfNeeded(edge.label.trim()))
      }
      lines.push(parts.join(" "))
    }
    return lines.join("\n")
  }

  const offset = state.indexMode === "1-index" ? 1 : 0
  const lines = [String(state.nodes.length)]

  for (const edge of state.edges) {
    const source = Number(edge.source) + offset
    const target = Number(edge.target) + offset
    const parts = [`${source}`, `${target}`]
    if (typeof edge.weight === "number" && Number.isFinite(edge.weight)) {
      parts.push(String(edge.weight))
    }
    if (edge.label?.trim()) {
      parts.push(quoteIfNeeded(edge.label.trim()))
    }
    lines.push(parts.join(" "))
  }

  const declared = new Set<string>()
  for (const edge of state.edges) {
    declared.add(edge.source)
    declared.add(edge.target)
  }
  for (const node of state.nodes) {
    if (declared.has(node.id)) continue
    lines.push(String(Number(node.id) + offset))
  }

  return lines.join("\n")
}
