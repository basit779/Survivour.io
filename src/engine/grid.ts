// Uniform spatial hash grid for broad-phase queries over thousands of moving
// entities (enemy<->player collision, projectile<->enemy hits, flocking
// separation). Rebuilt each frame from entity positions; cells store entity
// indices into an external array so we stay allocation-light.
//
// Cell size should be ~2x the typical query radius for good bucket counts.

export class SpatialGrid {
  readonly cellSize: number
  private invCell: number
  private cols: number
  private rows: number
  private originX: number
  private originY: number
  // Flat array of buckets; each bucket is an array of entity indices.
  private cells: number[][]

  constructor(worldWidth: number, worldHeight: number, cellSize: number) {
    this.cellSize = cellSize
    this.invCell = 1 / cellSize
    this.cols = Math.max(1, Math.ceil(worldWidth / cellSize))
    this.rows = Math.max(1, Math.ceil(worldHeight / cellSize))
    this.originX = 0
    this.originY = 0
    this.cells = new Array(this.cols * this.rows)
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = []
  }

  /** Recenter the grid so it covers a region around (cx, cy). Call before clear/insert. */
  recenter(cx: number, cy: number): void {
    this.originX = cx - (this.cols * this.cellSize) / 2
    this.originY = cy - (this.rows * this.cellSize) / 2
  }

  clear(): void {
    const cells = this.cells
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].length) cells[i].length = 0
    }
  }

  private cellIndex(x: number, y: number): number {
    let cx = ((x - this.originX) * this.invCell) | 0
    let cy = ((y - this.originY) * this.invCell) | 0
    if (cx < 0) cx = 0
    else if (cx >= this.cols) cx = this.cols - 1
    if (cy < 0) cy = 0
    else if (cy >= this.rows) cy = this.rows - 1
    return cy * this.cols + cx
  }

  /** Insert entity index `id` located at (x, y). */
  insert(id: number, x: number, y: number): void {
    this.cells[this.cellIndex(x, y)].push(id)
  }

  /**
   * Visit every entity index within `radius` of (x, y) by scanning the 3x3 (or
   * larger) block of cells the query circle overlaps. `cb` receives candidate ids
   * (broad-phase: caller must do the precise distance check).
   */
  query(x: number, y: number, radius: number, cb: (id: number) => void): void {
    const minCol = this.colOf(x - radius)
    const maxCol = this.colOf(x + radius)
    const minRow = this.rowOf(y - radius)
    const maxRow = this.rowOf(y + radius)
    for (let cy = minRow; cy <= maxRow; cy++) {
      const rowBase = cy * this.cols
      for (let cx = minCol; cx <= maxCol; cx++) {
        const bucket = this.cells[rowBase + cx]
        for (let i = 0; i < bucket.length; i++) cb(bucket[i])
      }
    }
  }

  private colOf(x: number): number {
    let c = ((x - this.originX) * this.invCell) | 0
    if (c < 0) c = 0
    else if (c >= this.cols) c = this.cols - 1
    return c
  }

  private rowOf(y: number): number {
    let r = ((y - this.originY) * this.invCell) | 0
    if (r < 0) r = 0
    else if (r >= this.rows) r = this.rows - 1
    return r
  }
}
