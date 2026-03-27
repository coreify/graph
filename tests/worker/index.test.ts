import { createInlineSimulation, createWorkerSimulation } from "../../src/worker"
import type { GraphEdge, GraphNode } from "../../src/core"

const nodes: GraphNode[] = [
  { id: "0", label: "0", x: 0, y: 0, vx: 0, vy: 0, fixed: false },
  { id: "1", label: "1", x: 10, y: 10, vx: 0, vy: 0, fixed: false },
]

const edges: GraphEdge[] = [{ source: "0", target: "1" }]

class FakeWorker {
  onmessage: ((event: MessageEvent<any>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent<any>) => void) | null = null

  postMessage(message: { id: number; type: "sync" | "tick" }) {
    if (!this.onmessage) return
    if (message.type === "sync") {
      this.onmessage({
        data: { id: message.id, type: "ack" },
      } as MessageEvent)
      return
    }

    this.onmessage({
      data: {
        id: message.id,
        type: "tick",
        payload: {
          running: false,
          nodes,
        },
      },
    } as MessageEvent)
  }

  terminate() {}

  triggerMalformedMessage() {
    this.onmessage?.({ data: { type: "tick" } } as MessageEvent)
  }
}

class ErrorWorker {
  onmessage: ((event: MessageEvent<any>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent<any>) => void) | null = null

  postMessage(message: { id: number; type: "sync" | "tick" }) {
    if (!this.onmessage) return
    if (message.type === "sync") {
      this.onmessage({
        data: { id: message.id, type: "ack" },
      } as MessageEvent)
    }
  }

  terminate() {}

  triggerError(message: string) {
    this.onerror?.({ message, error: new Error(message) } as ErrorEvent)
  }

  triggerMalformedMessage() {
    this.onmessage?.({ data: { type: "tick" } } as MessageEvent)
  }
}

class MalformedWorker {
  onmessage: ((event: MessageEvent<any>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent<any>) => void) | null = null

  postMessage(message: { id: number; type: "sync" | "tick" }) {
    if (message.type === "sync") {
      this.onmessage?.({
        data: { id: message.id, type: "ack" },
      } as MessageEvent)
    }
  }

  terminate() {}

  triggerMalformedMessage() {
    this.onmessage?.({ data: { type: "tick" } } as MessageEvent)
  }
}

describe("worker helpers", () => {
  test("runs inline simulation without a worker", () => {
    const sim = createInlineSimulation()
    sim.sync(nodes, edges, { centerX: 50, centerY: 50, idealLength: 20 })
    const result = sim.tick()

    expect(result.nodes).toHaveLength(2)
    expect(typeof result.running).toBe("boolean")
  })

  test("adapts to a custom worker", async () => {
    const worker = new FakeWorker() as unknown as Worker
    const sim = createWorkerSimulation({ worker })

    await sim.sync(nodes, edges)
    const result = await sim.tick()

    expect(result.running).toBe(false)
    expect(result.nodes).toHaveLength(2)
    sim.terminate()
  })

  test("rejects pending work if the worker errors", async () => {
    const worker = new ErrorWorker() as unknown as ErrorWorker & Worker
    const sim = createWorkerSimulation({ worker })
    await sim.sync(nodes, edges)
    const pending = sim.tick()

    worker.triggerError("worker exploded")

    await expect(pending).rejects.toThrow(/worker exploded/i)
  })

  test("rejects malformed worker messages", async () => {
    const worker = new MalformedWorker() as unknown as MalformedWorker & Worker
    const sim = createWorkerSimulation({ worker })

    await sim.sync(nodes, edges)
    const pending = sim.tick()
    worker.triggerMalformedMessage()

    await expect(pending).rejects.toThrow(/malformed worker message/i)
  })
})
