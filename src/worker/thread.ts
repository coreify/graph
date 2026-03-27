import { ForceSimulation } from "../core/simulation"
import type { GraphEdge, GraphNode } from "../core/types"

type SyncMessage<TNodeData, TEdgeData> = {
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

type TickMessage = {
  id: number
  type: "tick"
}

const simulation = new ForceSimulation()
let nodes: GraphNode[] = []

self.onmessage = (event: MessageEvent<SyncMessage<unknown, unknown> | TickMessage>) => {
  if (event.data.type === "sync") {
    nodes = event.data.payload.nodes.map((node) => ({ ...node }))
    simulation.mergeSyncNodes(nodes)
    simulation.syncEdges(event.data.payload.edges)
    simulation.setCenter(event.data.payload.centerX, event.data.payload.centerY)
    simulation.setIdealLength(event.data.payload.idealLength)
    self.postMessage({
      id: event.data.id,
      type: "ack",
    })
    return
  }

  const running = simulation.tick()
  nodes = simulation.writeBack(nodes)
  self.postMessage({
    id: event.data.id,
    type: "tick",
    payload: {
      running,
      nodes,
    },
  })
}
