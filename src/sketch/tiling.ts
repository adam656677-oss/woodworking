// Full-size printing: the drawing laid over letter pages at exactly 1:1, with overlap so the pages can be taped together.

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }
export type Tile = { id: string; col: number; row: number; x: number; y: number; w: number; h: number }

/** Letter portrait with 1/2" margins. */
export const PRINTABLE = { w: 7.5, h: 10 }
export const OVERLAP = 0.5

const colName = (c: number): string => (c < 26 ? String.fromCharCode(65 + c) : colName(Math.floor(c / 26) - 1) + colName(c % 26))

/**
 * Pages over the drawing. Columns run left to right (A, B, C…), rows top to bottom (1, 2…). Each tile is the drawing area
 * that page shows: x, y is its lower-left corner in drawing inches (y up).
 */
export function tilePages(b: Bounds, opts: { page?: { w: number; h: number }; overlap?: number } = {}): Tile[] {
  const page = opts.page ?? PRINTABLE
  const overlap = opts.overlap ?? OVERLAP
  const W = b.maxX - b.minX, H = b.maxY - b.minY
  const sx = page.w - overlap, sy = page.h - overlap
  const cols = Math.max(1, Math.ceil((W - overlap) / sx - 1e-9))
  const rows = Math.max(1, Math.ceil((H - overlap) / sy - 1e-9))
  const tiles: Tile[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const top = b.maxY - r * sy
      tiles.push({ id: `${colName(c)}${r + 1}`, col: c, row: r, x: b.minX + c * sx, y: top - page.h, w: page.w, h: page.h })
    }
  }
  return tiles
}
