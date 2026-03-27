import { ForceSimulation } from "../core/simulation"
import type { GraphEdge, GraphNode } from "../core/types"

type WorkerRequest<TNodeData, TEdgeData> =
  | {
      id: number
      type: "sync"
      payload: {
        nodes: GraphNode<TNodeData>[]
        edges: GraphEdge<TEdgeData>[]
        centerX: number
        centerY: number
        idealLength: number
      }
    }
  | {
      id: number
      type: "tick"
    }

type WorkerResponse<TNodeData> =
  | {
      id: number
      type: "ack"
    }
  | {
      id: number
      type: "tick"
      payload: {
        running: boolean
        nodes: GraphNode<TNodeData>[]
      }
    }

export interface WorkerSimulation<TNodeData = unknown, TEdgeData = unknown> {
  sync(
    nodes: GraphNode<TNodeData>[],
    edges: GraphEdge<TEdgeData>[],
    options?: {
      centerX?: number
      centerY?: number
      idealLength?: number
    }
  ): Promise<void>
  tick(): Promise<{
    running: boolean
    nodes: GraphNode<TNodeData>[]
  }>
  terminate(): void
}

export function createWorkerSimulation<TNodeData = unknown, TEdgeData = unknown>(options: {
  worker?: Worker
  workerFactory?: () => Worker
} = {}): WorkerSimulation<TNodeData, TEdgeData> {
  const resolvedWorker =
    options.worker ??
    options.workerFactory?.() ??
    (typeof Worker !== "undefined"
      ? new Worker(new URL("./thread.js", import.meta.url), { type: "module" })
      : null)

  if (!resolvedWorker) {
    throw new Error(
      "Web Worker support is not available. Provide a custom worker or workerFactory."
    )
  }
  const worker: Worker = resolvedWorker

  let nextId = 1
  const pending = new Map<
    number,
    {
      resolve: (value: WorkerResponse<TNodeData>) => void
      reject: (reason?: unknown) => void
    }
  >()

  function rejectAll(reason: unknown) {
    for (const entry of pending.values()) {
      entry.reject(reason)
    }
    pending.clear()
  }

  worker.onmessage = (event: MessageEvent<WorkerResponse<TNodeData>>) => {
    if (!event.data || typeof event.data !== "object" || !("id" in event.data)) {
      rejectAll(new Error("Malformed worker message."))
      return
    }
    const candidate = event.data as Partial<WorkerResponse<TNodeData>> & { id?: unknown }
    if (typeof candidate.id !== "number") {
      rejectAll(new Error("Malformed worker message."))
      return
    }
    const entry = pending.get(candidate.id)
    if (!entry) return
    pending.delete(candidate.id)
    entry.resolve(event.data as WorkerResponse<TNodeData>)
  }

  worker.onerror = (event) => {
    rejectAll(event.error ?? new Error(event.message))
  }

  worker.onmessageerror = () => {
    rejectAll(new Error("Worker message could not be decoded."))
  }

  function send(message: WorkerRequest<TNodeData, TEdgeData>) {
    return new Promise<WorkerResponse<TNodeData>>((resolve, reject) => {
      pending.set(message.id, { resolve, reject })
      try {
        worker.postMessage(message)
      } catch (error) {
        pending.delete(message.id)
        reject(error)
      }
    })
  }

  return {
    async sync(nodes, edges, simulationOptions = {}) {
      const id = nextId++
      await send({
        id,
        type: "sync",
        payload: {
          nodes,
          edges,
          centerX: simulationOptions.centerX ?? 300,
          centerY: simulationOptions.centerY ?? 250,
          idealLength: simulationOptions.idealLength ?? 140,
        },
      })
    },
    async tick() {
      const id = nextId++
      const response = await send({
        id,
        type: "tick",
      })
      if (response.type !== "tick") {
        return { running: false, nodes: [] }
      }
      return response.payload
    },
    terminate() {
      worker.terminate()
      rejectAll(new Error("Worker terminated."))
    },
  }
}

export function createInlineSimulation<TNodeData = unknown, TEdgeData = unknown>() {
  const simulation = new ForceSimulation<TNodeData, TEdgeData>()
  let nodes: GraphNode<TNodeData>[] = []

  return {
    sync(
      nextNodes: GraphNode<TNodeData>[],
      edges: GraphEdge<TEdgeData>[],
      options: { centerX?: number; centerY?: number; idealLength?: number } = {}
    ) {
      nodes = nextNodes.map((node) => ({ ...node }))
      simulation.mergeSyncNodes(nodes)
      simulation.syncEdges(edges)
      simulation.setCenter(options.centerX ?? 300, options.centerY ?? 250)
      simulation.setIdealLength(options.idealLength ?? 140)
    },
    tick() {
      const running = simulation.tick()
      nodes = simulation.writeBack(nodes)
      return {
        running,
        nodes: nodes.map((node) => ({ ...node })),
      }
    },
  }
}
