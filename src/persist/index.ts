import { deserialize, serialize } from "../serialization"
import type { GraphStore } from "../core/store"
import type { GraphState } from "../core/types"

function resolveStorage(storage?: Storage) {
  if (storage) return storage
  try {
    if (typeof localStorage !== "undefined") return localStorage
  } catch {
    return null
  }
  return null
}

export function saveToLocalStorage<TNodeData = unknown, TEdgeData = unknown>(
  key: string,
  state: GraphState<TNodeData, TEdgeData>,
  options: { storage?: Storage } = {}
) {
  const storage = resolveStorage(options.storage)
  if (!storage) return false
  try {
    storage.setItem(key, serialize(state))
    return true
  } catch {
    return false
  }
}

export function loadFromLocalStorage<TNodeData = unknown, TEdgeData = unknown>(
  key: string,
  options: { storage?: Storage } = {}
) {
  const storage = resolveStorage(options.storage)
  if (!storage) return null
  try {
    const value = storage.getItem(key)
    if (!value) return null
    return deserialize<TNodeData, TEdgeData>(value)
  } catch {
    return null
  }
}

export function removeFromLocalStorage(
  key: string,
  options: { storage?: Storage } = {}
) {
  const storage = resolveStorage(options.storage)
  if (!storage) return false
  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function createPersistPlugin<TNodeData = unknown, TEdgeData = unknown>(options: {
  key: string
  storage?: Storage
}) {
  function save(state: GraphState<TNodeData, TEdgeData>) {
    return saveToLocalStorage(options.key, state, {
      storage: options.storage,
    })
  }

  function load() {
    return loadFromLocalStorage<TNodeData, TEdgeData>(options.key, {
      storage: options.storage,
    })
  }

  function clear() {
    return removeFromLocalStorage(options.key, {
      storage: options.storage,
    })
  }

  return {
    key: options.key,
    storage: options.storage,
    save,
    load,
    clear,
    attach(store: GraphStore<TNodeData, TEdgeData>) {
      const restore = load()
      if (restore) {
        store.replaceState(restore, { recordHistory: false })
      }

      return store.subscribe(() => {
        save(store.getState())
      })
    },
  }
}
