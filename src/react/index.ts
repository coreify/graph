import * as React from "react"
import type { GraphStore } from "../core/store"
import type { GraphState } from "../core/types"

export function useGraphStore<TNodeData = unknown, TEdgeData = unknown>(
  store: GraphStore<TNodeData, TEdgeData>
) {
  return React.useSyncExternalStore(store.subscribe, store.getState, store.getState)
}

export function useGraphSelector<TNodeData = unknown, TEdgeData = unknown, TSelected = unknown>(
  store: GraphStore<TNodeData, TEdgeData>,
  selector: (state: GraphState<TNodeData, TEdgeData>) => TSelected
) {
  const getSnapshot = React.useCallback(() => selector(store.getState()), [selector, store])
  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)
}
