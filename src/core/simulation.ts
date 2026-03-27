import type { GraphEdge, GraphNode, QTCell } from "./types"

const DAMPING = 0.88
const BASE_REPULSION = 5000
const ATTRACTION = 0.008
const CENTER_GRAVITY = 0.015
const MIN_VELOCITY = 0.001
const BASE_IDEAL_LENGTH = 100

const ALPHA_INITIAL = 1
const ALPHA_MIN = 0.001
const ALPHA_DECAY = 0.0228

const BH_THETA_SQ = 0.81
const BH_NODE_THRESHOLD = 60

function qtNew(x0: number, y0: number, x1: number, y1: number): QTCell {
  return {
    x0,
    y0,
    x1,
    y1,
    cx: 0,
    cy: 0,
    mass: 0,
    bodyIdx: -1,
    children: [null, null, null, null],
  }
}

function qtQuadrant(px: number, py: number, mx: number, my: number) {
  return (px > mx ? 1 : 0) + (py > my ? 2 : 0)
}

function qtChild(cell: QTCell, quadrant: number): QTCell {
  if (cell.children[quadrant]) return cell.children[quadrant]!
  const mx = (cell.x0 + cell.x1) / 2
  const my = (cell.y0 + cell.y1) / 2
  const child = qtNew(
    quadrant & 1 ? mx : cell.x0,
    quadrant & 2 ? my : cell.y0,
    quadrant & 1 ? cell.x1 : mx,
    quadrant & 2 ? cell.y1 : my
  )
  cell.children[quadrant] = child
  return child
}

function qtInsert(
  cell: QTCell,
  index: number,
  px: number,
  py: number,
  xs: Float64Array,
  ys: Float64Array,
  depth: number
) {
  if (depth > 40) return
  if (cell.mass === 0) {
    cell.bodyIdx = index
    cell.mass = 1
    return
  }

  const mx = (cell.x0 + cell.x1) / 2
  const my = (cell.y0 + cell.y1) / 2

  if (cell.bodyIdx >= 0) {
    const existingIndex = cell.bodyIdx
    cell.bodyIdx = -1
    cell.mass = 0
    qtInsert(
      qtChild(cell, qtQuadrant(xs[existingIndex], ys[existingIndex], mx, my)),
      existingIndex,
      xs[existingIndex],
      ys[existingIndex],
      xs,
      ys,
      depth + 1
    )
  }

  qtInsert(
    qtChild(cell, qtQuadrant(px, py, mx, my)),
    index,
    px,
    py,
    xs,
    ys,
    depth + 1
  )
}

function qtMass(cell: QTCell, xs: Float64Array, ys: Float64Array) {
  if (cell.bodyIdx >= 0) {
    cell.cx = xs[cell.bodyIdx]
    cell.cy = ys[cell.bodyIdx]
    cell.mass = 1
    return
  }

  cell.cx = 0
  cell.cy = 0
  cell.mass = 0

  for (const child of cell.children) {
    if (!child) continue
    qtMass(child, xs, ys)
    cell.cx += child.cx * child.mass
    cell.cy += child.cy * child.mass
    cell.mass += child.mass
  }

  if (cell.mass > 0) {
    cell.cx /= cell.mass
    cell.cy /= cell.mass
  }
}

function qtForce(
  cell: QTCell,
  nodeIndex: number,
  nx: number,
  ny: number,
  repulsion: number,
  vx: Float64Array,
  vy: Float64Array
) {
  if (cell.mass === 0) return
  const dx = cell.cx - nx
  const dy = cell.cy - ny
  const distanceSquared = dx * dx + dy * dy

  if (cell.bodyIdx >= 0) {
    if (cell.bodyIdx !== nodeIndex && distanceSquared > 0) {
      const distance = Math.sqrt(distanceSquared)
      const force = repulsion / Math.max(distanceSquared, 1)
      vx[nodeIndex] -= (dx / distance) * force
      vy[nodeIndex] -= (dy / distance) * force
    }
    return
  }

  const width = cell.x1 - cell.x0
  if (distanceSquared > 0 && (width * width) / distanceSquared < BH_THETA_SQ) {
    const distance = Math.sqrt(distanceSquared)
    const force = (repulsion * cell.mass) / Math.max(distanceSquared, 1)
    vx[nodeIndex] -= (dx / distance) * force
    vy[nodeIndex] -= (dy / distance) * force
    return
  }

  for (const child of cell.children) {
    if (!child) continue
    qtForce(child, nodeIndex, nx, ny, repulsion, vx, vy)
  }
}

export class ForceSimulation<TNodeData = unknown, TEdgeData = unknown> {
  x = new Float64Array(0)
  y = new Float64Array(0)
  vx = new Float64Array(0)
  vy = new Float64Array(0)
  fixed = new Uint8Array(0)
  count = 0
  nodeIds: string[] = []

  private idToIndex = new Map<string, number>()
  private edgeSource = new Int32Array(0)
  private edgeTarget = new Int32Array(0)
  private edgeCount = 0

  alpha = ALPHA_INITIAL
  centerX = 300
  centerY = 250
  idealLength = 140
  boundaryMargin = 30

  syncNodes(nodes: GraphNode<TNodeData>[]) {
    const count = nodes.length
    if (count !== this.count) {
      this.x = new Float64Array(count)
      this.y = new Float64Array(count)
      this.vx = new Float64Array(count)
      this.vy = new Float64Array(count)
      this.fixed = new Uint8Array(count)
      this.count = count
    }

    this.nodeIds.length = 0
    this.idToIndex.clear()

    nodes.forEach((node, index) => {
      this.nodeIds.push(node.id)
      this.idToIndex.set(node.id, index)
      this.x[index] = node.x
      this.y[index] = node.y
      this.vx[index] = node.vx
      this.vy[index] = node.vy
      this.fixed[index] = node.fixed ? 1 : 0
    })
  }

  mergeSyncNodes(nodes: GraphNode<TNodeData>[]) {
    const previous = new Map(
      this.nodeIds.map((id, index) => [
        id,
        {
          x: this.x[index],
          y: this.y[index],
          vx: this.vx[index],
          vy: this.vy[index],
        },
      ])
    )

    this.syncNodes(
      nodes.map((node) => {
        const current = previous.get(node.id)
        return current ? { ...node, ...current } : node
      })
    )
  }

  syncEdges(edges: GraphEdge<TEdgeData>[]) {
    const sources: number[] = []
    const targets: number[] = []

    for (const edge of edges) {
      const source = this.idToIndex.get(edge.source)
      const target = this.idToIndex.get(edge.target)
      if (source === undefined || target === undefined) continue
      sources.push(source)
      targets.push(target)
    }

    this.edgeCount = sources.length
    this.edgeSource = new Int32Array(sources)
    this.edgeTarget = new Int32Array(targets)
  }

  setCenter(x: number, y: number) {
    this.centerX = x
    this.centerY = y
  }

  setIdealLength(length: number) {
    this.idealLength = length
  }

  reheat(alpha = 0.3) {
    this.alpha = Math.max(this.alpha, alpha)
  }

  indexOfId(id: string) {
    return this.idToIndex.get(id) ?? -1
  }

  setPosition(index: number, x: number, y: number) {
    if (index < 0 || index >= this.count) return
    this.x[index] = x
    this.y[index] = y
    this.vx[index] = 0
    this.vy[index] = 0
  }

  setFixed(index: number, fixed: boolean) {
    if (index < 0 || index >= this.count) return
    this.fixed[index] = fixed ? 1 : 0
  }

  tick() {
    const count = this.count
    if (count === 0) return false

    this.alpha += (0 - this.alpha) * ALPHA_DECAY
    if (this.alpha < ALPHA_MIN) {
      this.alpha = 0
      return false
    }

    const scale = this.idealLength / BASE_IDEAL_LENGTH
    const repulsion = BASE_REPULSION * scale * scale * this.alpha

    if (count > BH_NODE_THRESHOLD) {
      let minX = this.x[0]
      let minY = this.y[0]
      let maxX = this.x[0]
      let maxY = this.y[0]

      for (let index = 1; index < count; index += 1) {
        minX = Math.min(minX, this.x[index])
        minY = Math.min(minY, this.y[index])
        maxX = Math.max(maxX, this.x[index])
        maxY = Math.max(maxY, this.y[index])
      }

      const size = Math.max(maxX - minX, maxY - minY, 1) + 2
      const root = qtNew(
        (minX + maxX) / 2 - size / 2,
        (minY + maxY) / 2 - size / 2,
        (minX + maxX) / 2 + size / 2,
        (minY + maxY) / 2 + size / 2
      )

      for (let index = 0; index < count; index += 1) {
        qtInsert(root, index, this.x[index], this.y[index], this.x, this.y, 0)
      }

      qtMass(root, this.x, this.y)

      for (let index = 0; index < count; index += 1) {
        if (this.fixed[index] === 1) continue
        qtForce(
          root,
          index,
          this.x[index],
          this.y[index],
          repulsion,
          this.vx,
          this.vy
        )
      }
    } else {
      for (let left = 0; left < count; left += 1) {
        for (let right = left + 1; right < count; right += 1) {
          const dx = this.x[right] - this.x[left]
          const dy = this.y[right] - this.y[left]
          const distanceSquared = Math.max(dx * dx + dy * dy, 1)
          const distance = Math.sqrt(distanceSquared)
          const force = repulsion / distanceSquared
          const fx = (dx / distance) * force
          const fy = (dy / distance) * force

          if (this.fixed[left] === 0) {
            this.vx[left] -= fx
            this.vy[left] -= fy
          }
          if (this.fixed[right] === 0) {
            this.vx[right] += fx
            this.vy[right] += fy
          }
        }
      }
    }

    const attraction = ATTRACTION * this.alpha
    for (let index = 0; index < this.edgeCount; index += 1) {
      const source = this.edgeSource[index]
      const target = this.edgeTarget[index]
      const dx = this.x[target] - this.x[source]
      const dy = this.y[target] - this.y[source]
      const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
      const force = attraction * (distance - this.idealLength)
      const fx = (dx / distance) * force
      const fy = (dy / distance) * force

      if (this.fixed[source] === 0) {
        this.vx[source] += fx
        this.vy[source] += fy
      }
      if (this.fixed[target] === 0) {
        this.vx[target] -= fx
        this.vy[target] -= fy
      }
    }

    const gravity = (CENTER_GRAVITY / scale) * this.alpha
    for (let index = 0; index < count; index += 1) {
      if (this.fixed[index] === 1) continue
      this.vx[index] += (this.centerX - this.x[index]) * gravity
      this.vy[index] += (this.centerY - this.y[index]) * gravity
    }

    const min = this.boundaryMargin
    const maxX = Math.max(min, this.centerX * 2 - min)
    const maxY = Math.max(min, this.centerY * 2 - min)

    for (let index = 0; index < count; index += 1) {
      if (this.fixed[index] === 1) continue
      this.vx[index] *= DAMPING
      this.vy[index] *= DAMPING
      if (Math.abs(this.vx[index]) < MIN_VELOCITY) this.vx[index] = 0
      if (Math.abs(this.vy[index]) < MIN_VELOCITY) this.vy[index] = 0

      this.x[index] += this.vx[index]
      this.y[index] += this.vy[index]
      if (this.x[index] < min) this.x[index] = min
      if (this.x[index] > maxX) this.x[index] = maxX
      if (this.y[index] < min) this.y[index] = min
      if (this.y[index] > maxY) this.y[index] = maxY
    }

    return true
  }

  writeBack(nodes: GraphNode<TNodeData>[]) {
    return nodes.map((node) => {
      const index = this.idToIndex.get(node.id)
      if (index === undefined) return node
      return {
        ...node,
        x: this.x[index],
        y: this.y[index],
        vx: this.vx[index],
        vy: this.vy[index],
        fixed: this.fixed[index] === 1,
      }
    })
  }
}
