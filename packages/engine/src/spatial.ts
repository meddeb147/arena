export interface Positioned {
  x: number;
  y: number;
}

/** Uniform-grid spatial hash for items that move rarely (pellets, mines, traps). */
export class SpatialGrid<T extends Positioned> {
  private readonly cols: number;
  private readonly rows: number;
  private readonly cells: Array<Set<T>>;

  constructor(width: number, height: number, private readonly cellSize: number) {
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
    this.cells = Array.from({ length: this.cols * this.rows }, () => new Set<T>());
  }

  private index(x: number, y: number): number {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cellSize)));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cellSize)));
    return cy * this.cols + cx;
  }

  insert(item: T): void {
    this.cells[this.index(item.x, item.y)]!.add(item);
  }

  remove(item: T): void {
    this.cells[this.index(item.x, item.y)]!.delete(item);
  }

  /** Call after changing an item's position; pass its previous position. */
  move(item: T, oldX: number, oldY: number): void {
    const a = this.index(oldX, oldY);
    const b = this.index(item.x, item.y);
    if (a !== b) {
      this.cells[a]!.delete(item);
      this.cells[b]!.add(item);
    }
  }

  /** Visit items whose cell intersects the circle's bounding box. Return `false` to stop early. */
  query(x: number, y: number, radius: number, fn: (item: T) => boolean | void): void {
    const cs = this.cellSize;
    const x0 = Math.max(0, Math.floor((x - radius) / cs));
    const x1 = Math.min(this.cols - 1, Math.floor((x + radius) / cs));
    const y0 = Math.max(0, Math.floor((y - radius) / cs));
    const y1 = Math.min(this.rows - 1, Math.floor((y + radius) / cs));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        for (const item of this.cells[cy * this.cols + cx]!) {
          if (fn(item) === false) return;
        }
      }
    }
  }
}
