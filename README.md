# `@coreify/graph`

Headless, framework-agnostic graph engine with optional React bindings.

It ships with:
- a reactive graph store
- force-directed simulation
- layout helpers
- text parsing and generation
- graph algorithms
- serialization helpers
- persistence helpers
- optional worker-based simulation
- optional React hooks

## Install

```bash
npm install @coreify/graph
```

If you use the React bindings:

```bash
npm install react
```

## Package Structure

```ts
import { createGraphStore, createInlineSimulation, ForceSimulation } from "@coreify/graph/core"
import { useGraphStore, useGraphSelector } from "@coreify/graph/react"
import { bfs, dijkstra, topoSort } from "@coreify/graph/algorithms"
import { serialize, deserialize, toDOT } from "@coreify/graph/serialization"
import { saveToLocalStorage, loadFromLocalStorage } from "@coreify/graph/persist"
import { createWorkerSimulation } from "@coreify/graph/worker"
```

The root barrel also re-exports the main headless APIs:

```ts
import { createGraphStore, bfs, serialize } from "@coreify/graph"
```

Use explicit subpaths for `worker`.

## Core Example

```ts
import { createGraphStore, DEFAULT_CONFIG } from "@coreify/graph/core"

const store = createGraphStore({
  initialState: {
    direction: "undirected",
    indexMode: "0-index",
    config: DEFAULT_CONFIG,
    nodes: [
      { id: "0", label: "0", x: 120, y: 120, vx: 0, vy: 0, fixed: false },
      { id: "1", label: "1", x: 260, y: 160, vx: 0, vy: 0, fixed: false },
    ],
    edges: [{ source: "0", target: "1", weight: 2 }],
  },
})

store.addNode({
  id: "2",
  label: "2",
  x: 320,
  y: 240,
  vx: 0,
  vy: 0,
  fixed: false,
})

store.addEdge({ source: "1", target: "2", label: "road" })
store.arrangeCircular()

const snapshot = store.getState()
console.log(snapshot.nodes.length)
```

## Typed Events

```ts
import { createGraphStore } from "@coreify/graph/core"

const store = createGraphStore()

store.on("node:add", (node) => {
  console.log("added node", node.id)
})

store.on("layout:change", ({ algorithm }) => {
  console.log("layout changed", algorithm)
})

store.on("parse:error", (issues) => {
  console.error(issues)
})
```

## Text Format

The parser supports:
- indexed graphs
- comment lines with `#`
- isolated nodes
- named-node edges
- validation issues with line numbers

### Indexed format

```txt
# node count
4
0 1 3.5 "road A"
1 2
3
```

### Named format

```txt
Alice
Bob
Alice -> Bob 2 "friendship"
```

### Parsing example

```ts
import { createGraphStore } from "@coreify/graph/core"

const store = createGraphStore()

const result = store.parseFromText(`
  # graph
  3
  0 1 4 "A"
  2
`)

if (!result.ok) {
  console.error(result.issues)
}
```

## Force Simulation

```ts
import { ForceSimulation } from "@coreify/graph/core"

const simulation = new ForceSimulation()
simulation.syncNodes(nodes)
simulation.syncEdges(edges)
simulation.setCenter(400, 300)
simulation.setIdealLength(140)

while (simulation.tick()) {
  // loop until alpha cools down
}

const nextNodes = simulation.writeBack(nodes)
```

If you want a synchronous simulation loop without a worker, use the inline helper:

```ts
import { createInlineSimulation } from "@coreify/graph/core"

const simulation = createInlineSimulation()
simulation.sync(nodes, edges, { centerX: 400, centerY: 300 })
const { running, nodes: nextNodes } = simulation.tick()
```

## Layouts

```ts
import { arrangeCircular, arrangeGrid, arrangeLayered } from "@coreify/graph/core"

const circular = arrangeCircular(nodes, { canvasSize: { width: 800, height: 600 } })
const grid = arrangeGrid(nodes, { canvasSize: { width: 800, height: 600 } })
const layered = arrangeLayered(nodes, edges, {
  canvasSize: { width: 800, height: 600 },
  direction: "directed",
})
```

## Algorithms

```ts
import {
  bfs,
  dfs,
  dijkstra,
  bellmanFord,
  connectedComponents,
  stronglyConnectedComponents,
  hasCycle,
  topoSort,
  kruskal,
  prim,
  degreeCentrality,
  betweennessCentrality,
} from "@coreify/graph/algorithms"

const traversal = bfs(nodes, edges, "A")
const shortest = dijkstra(nodes, edges, "A")
const order = topoSort(nodes, directedEdges)

console.log(traversal.pathTo("C"))
console.log(shortest.distances)
console.log(order)
```

## Serialization

```ts
import {
  serialize,
  deserialize,
  encodeGraphStateForShare,
  decodeGraphStateFromShare,
  toAdjacencyList,
  toAdjacencyMatrix,
  toDOT,
} from "@coreify/graph/serialization"

const json = serialize(store.getState())
const restored = deserialize(json)

const encoded = encodeGraphStateForShare(store.getState())
const decoded = decodeGraphStateFromShare(encoded)

const adjacencyList = toAdjacencyList(decoded.nodes, decoded.edges)
const adjacencyMatrix = toAdjacencyMatrix(decoded.nodes, decoded.edges)
const dot = toDOT(decoded.nodes, decoded.edges, { directed: true, graphName: "G" })
```

## Persistence

```ts
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  createPersistPlugin,
} from "@coreify/graph/persist"

saveToLocalStorage("demo-graph", store.getState())

const restored = loadFromLocalStorage("demo-graph")
if (restored) {
  store.replaceState(restored)
}

const persist = createPersistPlugin({
  key: "demo-graph",
  storage: sessionStorage,
})

const detach = persist.attach(store)
detach()
```

## React Bindings

The React hooks are instance-based. This package does not export a singleton store.

```tsx
import { createGraphStore } from "@coreify/graph/core"
import { useGraphSelector, useGraphStore } from "@coreify/graph/react"

const store = createGraphStore()

export function GraphPanel() {
  const state = useGraphStore(store)
  const edgeCount = useGraphSelector(store, (snapshot) => snapshot.edges.length)

  return (
    <div>
      <p>Nodes: {state.nodes.length}</p>
      <p>Edges: {edgeCount}</p>
    </div>
  )
}
```

## Worker Simulation

Use the worker wrapper when you want the simulation loop off the main thread.

```ts
import { createWorkerSimulation } from "@coreify/graph/worker"

const workerSimulation = createWorkerSimulation()

await workerSimulation.sync(nodes, edges, {
  centerX: 400,
  centerY: 300,
  idealLength: 160,
})

const { running, nodes: nextNodes } = await workerSimulation.tick()

if (!running) {
  workerSimulation.terminate()
}
```

## Behavior Notes

- Traversal and shortest-path helpers require an existing start node. If the `startId` is missing, they throw.
- `prim()` requires a connected graph and throws on disconnected input.
- Named text output preserves quoted identifiers and labels, including escaped characters.
- Indexed text output is only used when node IDs form a true contiguous numeric range for the current index mode.
- Persistence helpers fail closed when storage is unavailable or throws.
- Worker simulation rejects malformed worker messages instead of hanging pending calls.
