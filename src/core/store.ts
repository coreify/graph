import { DEFAULT_CANVAS_SIZE, DEFAULT_CONFIG, DEFAULT_HISTORY_LIMIT } from "./constants"
import { clamp } from "./helpers/validation"
import { applyLayout, getEdgeKey } from "./layouts"
import { generateGraphText, parseGraphText } from "./text"
import type {
  GraphCanvasSize,
  GraphDirection,
  GraphEdge,
  GraphIndexMode,
  GraphMutationOptions,
  GraphNode,
  GraphSnapshot,
  GraphState,
  GraphStoreEventMap,
  GraphStoreListener,
  LayoutAlgorithm,
  ParseGraphResult,
} from "./types"

export interface CreateGraphStoreOptions<TNodeData = unknown, TEdgeData = unknown> {
  initialState?: Partial<GraphState<TNodeData, TEdgeData>>
  historyLimit?: number
  random?: () => number
}

export interface GraphStore<TNodeData = unknown, TEdgeData = unknown> {
  getState(): GraphState<TNodeData, TEdgeData>
  subscribe(listener: GraphStoreListener): () => void
  on<K extends keyof GraphStoreEventMap<TNodeData, TEdgeData>>(
    event: K,
    listener: (payload: GraphStoreEventMap<TNodeData, TEdgeData>[K]) => void
  ): () => void
  setState(
    partial: Partial<GraphState<TNodeData, TEdgeData>>,
    options?: GraphMutationOptions
  ): void
  replaceState(
    nextState: GraphState<TNodeData, TEdgeData>,
    options?: GraphMutationOptions
  ): void
  setNodes(nodes: GraphNode<TNodeData>[], options?: GraphMutationOptions): void
  setEdges(edges: GraphEdge<TEdgeData>[], options?: GraphMutationOptions): void
  setDirection(direction: GraphDirection, options?: GraphMutationOptions): void
  setIndexMode(indexMode: GraphIndexMode, options?: GraphMutationOptions): void
  setCanvasSize(width: number, height: number, options?: GraphMutationOptions): void
  addNode(node: GraphNode<TNodeData>, options?: GraphMutationOptions): void
  updateNode(
    id: string,
    patch: Partial<GraphNode<TNodeData>>,
    options?: GraphMutationOptions
  ): void
  removeNode(id: string, options?: GraphMutationOptions): void
  addEdge(edge: GraphEdge<TEdgeData>, options?: GraphMutationOptions): void
  updateEdge(
    source: string,
    target: string,
    patch: Partial<GraphEdge<TEdgeData>>,
    options?: GraphMutationOptions
  ): void
  removeEdge(source: string, target: string, options?: GraphMutationOptions): void
  updateNodePosition(
    id: string,
    x: number,
    y: number,
    options?: GraphMutationOptions
  ): void
  toggleNodeFixed(id: string, options?: GraphMutationOptions): void
  setNodeFixed(id: string, fixed: boolean, options?: GraphMutationOptions): void
  fixAllNodes(options?: GraphMutationOptions): void
  unfixAllNodes(options?: GraphMutationOptions): void
  applyLayout(algorithm: LayoutAlgorithm, options?: GraphMutationOptions): void
  arrangeCircular(options?: GraphMutationOptions): void
  arrangeGrid(options?: GraphMutationOptions): void
  arrangeLayered(options?: GraphMutationOptions): void
  parseFromText(text: string): ParseGraphResult<TNodeData, TEdgeData>
  generateText(options?: { preferNamedFormat?: boolean }): string
  clearGraph(options?: GraphMutationOptions): void
  canUndo(): boolean
  canRedo(): boolean
  undo(): void
  redo(): void
}

function cloneNodes<TNodeData>(nodes: GraphNode<TNodeData>[]) {
  return nodes.map((node) => ({ ...node }))
}

function cloneEdges<TEdgeData>(edges: GraphEdge<TEdgeData>[]) {
  return edges.map((edge) => ({ ...edge }))
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value
  }
  Object.freeze(value)
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item)
    }
    return value
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key])
  }
  return value
}

function cloneState<TNodeData, TEdgeData>(
  state: GraphState<TNodeData, TEdgeData>
): GraphState<TNodeData, TEdgeData> {
  return deepFreeze({
    nodes: cloneNodes(state.nodes),
    edges: cloneEdges(state.edges),
    direction: state.direction,
    indexMode: state.indexMode,
    config: { ...state.config },
    customLabels: { ...state.customLabels },
    canvasSize: { ...state.canvasSize },
  })
}

function sameEdge<TEdgeData>(
  direction: GraphDirection,
  left: GraphEdge<TEdgeData>,
  source: string,
  target: string
) {
  if (direction === "directed") {
    return left.source === source && left.target === target
  }
  return (
    (left.source === source && left.target === target) ||
    (left.source === target && left.target === source)
  )
}

function normalizeInitialState<TNodeData, TEdgeData>(
  initialState?: Partial<GraphState<TNodeData, TEdgeData>>
): GraphState<TNodeData, TEdgeData> {
  return deepFreeze({
    nodes: cloneNodes(initialState?.nodes ?? []),
    edges: cloneEdges(initialState?.edges ?? []),
    direction: initialState?.direction ?? "undirected",
    indexMode: initialState?.indexMode ?? "0-index",
    config: { ...DEFAULT_CONFIG, ...(initialState?.config ?? {}) },
    customLabels: { ...(initialState?.customLabels ?? {}) },
    canvasSize: { ...DEFAULT_CANVAS_SIZE, ...(initialState?.canvasSize ?? {}) },
  })
}

export function createGraphStore<TNodeData = unknown, TEdgeData = unknown>(
  options: CreateGraphStoreOptions<TNodeData, TEdgeData> = {}
): GraphStore<TNodeData, TEdgeData> {
  let state = normalizeInitialState(options.initialState)
  const listeners = new Set<GraphStoreListener>()
  const historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT
  const past: GraphSnapshot<TNodeData, TEdgeData>[] = []
  const future: GraphSnapshot<TNodeData, TEdgeData>[] = []
  const events = new Map<string, Set<(payload: unknown) => void>>()

  function emitState() {
    const snapshot = getState()
    listeners.forEach((listener) => listener())
    events.get("state:change")?.forEach((listener) => listener(snapshot))
  }

  function emit<K extends keyof GraphStoreEventMap<TNodeData, TEdgeData>>(
    event: K,
    payload: GraphStoreEventMap<TNodeData, TEdgeData>[K]
  ) {
    events.get(event)?.forEach((listener) => listener(payload))
  }

  function snapshotFromState() {
    return cloneState(state)
  }

  function pushHistory() {
    past.push(snapshotFromState())
    if (past.length > historyLimit) {
      past.shift()
    }
    future.length = 0
  }

  function commit(
    nextState: GraphState<TNodeData, TEdgeData>,
    mutationOptions: GraphMutationOptions = {}
  ) {
    if (mutationOptions.recordHistory !== false) {
      pushHistory()
    }
    state = cloneState(nextState)
    emitState()
  }

  function updateNodeLabels(indexMode: GraphIndexMode, currentState = state) {
    const offset = indexMode === "1-index" ? 1 : 0
    return currentState.nodes.map((node, index) => ({
      ...node,
      label:
        indexMode === "custom"
          ? currentState.customLabels[node.id] ?? node.label
          : String(index + offset),
    }))
  }

  function getState() {
    return state
  }

  function subscribe(listener: GraphStoreListener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function on<K extends keyof GraphStoreEventMap<TNodeData, TEdgeData>>(
    event: K,
    listener: (payload: GraphStoreEventMap<TNodeData, TEdgeData>[K]) => void
  ) {
    const set = events.get(event) ?? new Set<(payload: unknown) => void>()
    set.add(listener as (payload: unknown) => void)
    events.set(event, set)
    return () => set.delete(listener as (payload: unknown) => void)
  }

  function setState(
    partial: Partial<GraphState<TNodeData, TEdgeData>>,
    mutationOptions: GraphMutationOptions = {}
  ) {
    commit(
      {
        ...state,
        ...partial,
        config: partial.config ? { ...state.config, ...partial.config } : state.config,
        customLabels: partial.customLabels
          ? { ...partial.customLabels }
          : { ...state.customLabels },
        canvasSize: partial.canvasSize
          ? { ...state.canvasSize, ...partial.canvasSize }
          : { ...state.canvasSize },
        nodes: partial.nodes ? cloneNodes(partial.nodes) : cloneNodes(state.nodes),
        edges: partial.edges ? cloneEdges(partial.edges) : cloneEdges(state.edges),
      },
      mutationOptions
    )
  }

  function replaceState(
    nextState: GraphState<TNodeData, TEdgeData>,
    mutationOptions: GraphMutationOptions = {}
  ) {
    commit(nextState, mutationOptions)
  }

  function setNodes(nodes: GraphNode<TNodeData>[], mutationOptions: GraphMutationOptions = {}) {
    commit({ ...state, nodes: cloneNodes(nodes) }, mutationOptions)
  }

  function setEdges(edges: GraphEdge<TEdgeData>[], mutationOptions: GraphMutationOptions = {}) {
    commit({ ...state, edges: cloneEdges(edges) }, mutationOptions)
  }

  function setDirection(direction: GraphDirection, mutationOptions: GraphMutationOptions = {}) {
    if (state.direction === direction) return
    commit({ ...state, direction }, mutationOptions)
  }

  function setIndexMode(indexMode: GraphIndexMode, mutationOptions: GraphMutationOptions = {}) {
    if (state.indexMode === indexMode) return
    commit(
      {
        ...state,
        indexMode,
        nodes: updateNodeLabels(indexMode),
      },
      mutationOptions
    )
  }

  function setCanvasSize(
    width: number,
    height: number,
    mutationOptions: GraphMutationOptions = {}
  ) {
    const canvasSize: GraphCanvasSize = {
      width: Math.max(0, Math.floor(width)),
      height: Math.max(0, Math.floor(height)),
    }
    if (
      canvasSize.width === state.canvasSize.width &&
      canvasSize.height === state.canvasSize.height
    ) {
      return
    }
    commit({ ...state, canvasSize }, mutationOptions)
  }

  function addNode(node: GraphNode<TNodeData>, mutationOptions: GraphMutationOptions = {}) {
    if (state.nodes.some((current) => current.id === node.id)) return
    commit({ ...state, nodes: [...state.nodes, { ...node }] }, mutationOptions)
    emit("node:add", { ...node })
  }

  function updateNode(
    id: string,
    patch: Partial<GraphNode<TNodeData>>,
    mutationOptions: GraphMutationOptions = {}
  ) {
    const index = state.nodes.findIndex((node) => node.id === id)
    if (index < 0) return
    const nodes = cloneNodes(state.nodes)
    nodes[index] = { ...nodes[index], ...patch }
    commit({ ...state, nodes }, mutationOptions)
    emit("node:update", { ...nodes[index] })
  }

  function removeNode(id: string, mutationOptions: GraphMutationOptions = {}) {
    const node = state.nodes.find((current) => current.id === id)
    if (!node) return
    commit(
      {
        ...state,
        nodes: state.nodes.filter((current) => current.id !== id),
        edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id),
      },
      mutationOptions
    )
    emit("node:remove", { ...node })
  }

  function addEdge(edge: GraphEdge<TEdgeData>, mutationOptions: GraphMutationOptions = {}) {
    if (edge.source === edge.target) return
    if (!state.nodes.some((node) => node.id === edge.source)) return
    if (!state.nodes.some((node) => node.id === edge.target)) return
    const exists = state.edges.some((current) =>
      sameEdge(state.direction, current, edge.source, edge.target)
    )
    if (exists) return
    commit({ ...state, edges: [...state.edges, { ...edge }] }, mutationOptions)
    emit("edge:add", { ...edge })
  }

  function updateEdge(
    source: string,
    target: string,
    patch: Partial<GraphEdge<TEdgeData>>,
    mutationOptions: GraphMutationOptions = {}
  ) {
    const index = state.edges.findIndex((edge) =>
      sameEdge(state.direction, edge, source, target)
    )
    if (index < 0) return
    const edges = cloneEdges(state.edges)
    edges[index] = { ...edges[index], ...patch }
    commit({ ...state, edges }, mutationOptions)
    emit("edge:update", { ...edges[index] })
  }

  function removeEdge(
    source: string,
    target: string,
    mutationOptions: GraphMutationOptions = {}
  ) {
    const edge = state.edges.find((current) => sameEdge(state.direction, current, source, target))
    if (!edge) return
    commit(
      {
        ...state,
        edges: state.edges.filter((current) => !sameEdge(state.direction, current, source, target)),
      },
      mutationOptions
    )
    emit("edge:remove", { ...edge })
  }

  function updateNodePosition(
    id: string,
    x: number,
    y: number,
    mutationOptions: GraphMutationOptions = {}
  ) {
    const index = state.nodes.findIndex((node) => node.id === id)
    if (index < 0) return
    const margin = state.config.nodeRadius + 10
    const maxX = Math.max(margin, state.canvasSize.width - margin)
    const maxY = Math.max(margin, state.canvasSize.height - margin)
    updateNode(
      id,
      {
        x: clamp(x, margin, maxX),
        y: clamp(y, margin, maxY),
        vx: 0,
        vy: 0,
      },
      mutationOptions
    )
  }

  function toggleNodeFixed(id: string, mutationOptions: GraphMutationOptions = {}) {
    const node = state.nodes.find((current) => current.id === id)
    if (!node) return
    updateNode(id, { fixed: !node.fixed }, mutationOptions)
  }

  function setNodeFixed(
    id: string,
    fixed: boolean,
    mutationOptions: GraphMutationOptions = {}
  ) {
    const node = state.nodes.find((current) => current.id === id)
    if (!node || node.fixed === fixed) return
    updateNode(id, { fixed }, mutationOptions)
  }

  function fixAllNodes(mutationOptions: GraphMutationOptions = {}) {
    const nodes = state.nodes.map((node) => ({
      ...node,
      fixed: true,
    }))
    commit({ ...state, nodes }, mutationOptions)
  }

  function unfixAllNodes(mutationOptions: GraphMutationOptions = {}) {
    const nodes = state.nodes.map((node) => ({
      ...node,
      fixed: false,
    }))
    commit({ ...state, nodes }, mutationOptions)
  }

  function applyGraphLayout(
    algorithm: LayoutAlgorithm,
    mutationOptions: GraphMutationOptions = {}
  ) {
    const nodes = applyLayout(algorithm, state.nodes, state.edges, {
      canvasSize: state.canvasSize,
      direction: state.direction,
      nodeRadius: state.config.nodeRadius,
    })
    commit({ ...state, nodes }, mutationOptions)
    emit("layout:change", { algorithm, nodes: cloneNodes(nodes) })
  }

  function parseFromText(text: string) {
    const result = parseGraphText<TNodeData, TEdgeData>(text, {
      indexMode: state.indexMode,
      direction: state.direction,
      existingNodes: state.nodes,
      customLabels: state.customLabels,
      canvasSize: state.canvasSize,
      nodeRadius: state.config.nodeRadius,
      random: options.random,
    })

    if (!result.ok) {
      emit("parse:error", result.issues)
      return result
    }

    commit(
      {
        ...state,
        nodes: cloneNodes(result.value.nodes),
        edges: cloneEdges(result.value.edges),
        customLabels: { ...result.value.customLabels },
      },
      {}
    )
    emit("parse:success", result.value)
    return result
  }

  function generateText(options?: { preferNamedFormat?: boolean }) {
    return generateGraphText(state, options)
  }

  function clearGraph(mutationOptions: GraphMutationOptions = {}) {
    const nextState = {
      ...state,
      nodes: [],
      edges: [],
      customLabels: {},
      config: { ...DEFAULT_CONFIG },
    }
    commit(nextState, mutationOptions)
    emit("clear", getState())
  }

  function canUndo() {
    return past.length > 0
  }

  function canRedo() {
    return future.length > 0
  }

  function undo() {
    const previous = past.pop()
    if (!previous) return
    future.push(snapshotFromState())
    state = cloneState(previous)
    emitState()
    emit("history:undo", previous)
  }

  function redo() {
    const next = future.pop()
    if (!next) return
    past.push(snapshotFromState())
    state = cloneState(next)
    emitState()
    emit("history:redo", next)
  }

  return {
    getState,
    subscribe,
    on,
    setState,
    replaceState,
    setNodes,
    setEdges,
    setDirection,
    setIndexMode,
    setCanvasSize,
    addNode,
    updateNode,
    removeNode,
    addEdge,
    updateEdge,
    removeEdge,
    updateNodePosition,
    toggleNodeFixed,
    setNodeFixed,
    fixAllNodes,
    unfixAllNodes,
    applyLayout: applyGraphLayout,
    arrangeCircular: (mutationOptions) => applyGraphLayout("circular", mutationOptions),
    arrangeGrid: (mutationOptions) => applyGraphLayout("grid", mutationOptions),
    arrangeLayered: (mutationOptions) => applyGraphLayout("layered", mutationOptions),
    parseFromText,
    generateText,
    clearGraph,
    canUndo,
    canRedo,
    undo,
    redo,
  }
}

export function isDuplicateEdge(
  direction: GraphDirection,
  edges: GraphEdge<unknown>[],
  source: string,
  target: string
) {
  const targetKey = getEdgeKey(source, target, direction)
  return edges.some((edge) => getEdgeKey(edge.source, edge.target, direction) === targetKey)
}
