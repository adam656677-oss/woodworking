// Cutting layouts: guillotine strips on sheets (rip strips, then crosscut), and lengths of lumber to buy.
import type { Project, Wood } from '../model/types'
import { formatInches } from '../model/units'
import { piecesOf, type Piece } from './pieces'
import { HARDWOOD_BOARD, settingsFor } from './settings'

/** A sheet, offcut or board to cut from (w across, l along its grain), with its trims. */
export type Stock = { id: string; label: string; w: number; l: number; edgeTrim: number; endTrim: number; fromShop?: string }
export type Placed = { piece: Piece; x: number; y: number; w: number; l: number; rotated: boolean }
export type Strip = { x: number; w: number; parts: Placed[]; used: number }
export type Area = { x: number; y: number; w: number; l: number }
export type SheetLayout = { stock: Stock; strips: Strip[]; offcuts: Area[]; cuts: string[]; usedArea: number }
export type PackResult = { sheets: SheetLayout[]; tooBig: Piece[]; ripWidths: number; waste: number; apart: string[] }

const EPS = 1e-6
const area = (s: Stock) => (s.w - 2 * s.edgeTrim) * (s.l - 2 * s.endTrim)

type Item = { piece: Piece; w: number; l: number; rotated: boolean }
type Strategy = { mixed: boolean; rotate: boolean }

function orient(p: Piece, rotate: boolean): Item {
  // Grain-free parts go whichever way is longer along the sheet; with `rotate`, the other way (a second try).
  if (p.grain) return { piece: p, w: p.w, l: p.l, rotated: false }
  const longAlong = p.l >= p.w
  const flip = rotate ? longAlong : !longAlong
  return flip ? { piece: p, w: p.l, l: p.w, rotated: true } : { piece: p, w: p.w, l: p.l, rotated: false }
}

function fill(stock: Stock, items: Item[], kerf: number, s: Strategy): { layout: SheetLayout | null; left: Item[] } {
  const W = stock.w - 2 * stock.edgeTrim, L = stock.l - 2 * stock.endTrim
  let left = [...items]
  const strips: Strip[] = []
  let x = 0
  for (;;) {
    const room = W - x
    const fits = left.filter(it => it.w <= room + EPS && it.l <= L + EPS)
    if (!fits.length) break
    const sw = fits[0].w
    const strip: Strip = { x, w: sw, parts: [], used: 0 }
    const place = (pred: (it: Item) => boolean) => {
      for (const it of [...left].filter(pred).sort((a, b) => b.l - a.l)) {
        const at = strip.parts.length ? strip.used + kerf : 0
        if (at + it.l > L + EPS) continue
        strip.parts.push({ piece: it.piece, x, y: at, w: it.w, l: it.l, rotated: it.rotated })
        strip.used = at + it.l
        left = left.filter(q => q !== it)
      }
    }
    // Same width first (one fence setting per strip), then — if allowed — narrower parts in what's left.
    place(it => Math.abs(it.w - sw) < EPS)
    if (s.mixed) place(it => it.w < sw - EPS)
    strips.push(strip)
    x += sw + kerf
  }
  if (!strips.length) return { layout: null, left }
  const offcuts: Area[] = []
  for (const st of strips) if (L - st.used - kerf > 1) offcuts.push({ x: st.x, y: st.used + kerf, w: st.w, l: L - st.used - kerf })
  const usedW = strips[strips.length - 1].x + strips[strips.length - 1].w
  if (W - usedW - kerf > 1) offcuts.push({ x: usedW + kerf, y: 0, w: W - usedW - kerf, l: L })
  const cuts: string[] = []
  strips.forEach(st => {
    cuts.push(`Rip a strip ${formatInches(st.w)} wide`)
    cuts.push(`Crosscut it: ${st.parts.map(q => `${formatInches(q.l)} (P${q.piece.no} ${q.piece.name}${Math.abs(q.w - st.w) > EPS ? `, then rip to ${formatInches(q.w)}` : ''})`).join(', ')}`)
  })
  const usedArea = strips.reduce((n, st) => n + st.parts.reduce((m, q) => m + q.w * q.l, 0), 0)
  return { layout: { stock, strips, offcuts, cuts, usedArea }, left }
}

/** Packs pieces onto the shop's stock first, then as many new sheets as it takes; tries a few ways and keeps the best. */
export function packSheets(pieces: Piece[], sheet: Omit<Stock, 'id' | 'label'> & { label: string }, kerf: number, shop: Stock[] = []): PackResult {
  const tries: PackResult[] = []
  for (const s of [{ mixed: false, rotate: false }, { mixed: true, rotate: false }, { mixed: false, rotate: true }, { mixed: true, rotate: true }] as Strategy[]) {
    let left = pieces.map(p => orient(p, s.rotate))
    // Widest first, and parts kept together next to each other.
    left.sort((a, b) => b.w - a.w || (a.piece.together ?? '').localeCompare(b.piece.together ?? '') || b.l - a.l)
    const sheets: SheetLayout[] = []
    for (const st of shop) { const r = fill(st, left, kerf, s); if (r.layout) { sheets.push(r.layout); left = r.left } }
    let n = 0
    for (;;) {
      if (!left.length) break
      const r = fill({ ...sheet, id: `new-${n + 1}`, label: `${sheet.label} ${n + 1}` }, left, kerf, s)
      if (!r.layout) break
      sheets.push(r.layout); left = r.left; n++
    }
    const widths = new Set(sheets.flatMap(sh => sh.strips.map(st => Math.round(st.w * 64))))
    const waste = sheets.reduce((x, sh) => x + area(sh.stock) - sh.usedArea, 0)
    // Parts meant to come from one sheet that ended up on two.
    const where = new Map<string, Set<number>>()
    sheets.forEach((sh, i) => sh.strips.forEach(st => st.parts.forEach(q => { const t = q.piece.together; if (t) where.set(t, new Set([...(where.get(t) ?? []), i])) })))
    const apart = [...where.entries()].filter(([, v]) => v.size > 1).map(([k]) => k)
    tries.push({ sheets, tooBig: left.map(it => it.piece), ripWidths: widths.size, waste, apart })
  }
  const newSheets = (r: PackResult) => r.sheets.filter(s => !s.stock.fromShop).length
  tries.sort((a, b) => a.tooBig.length - b.tooBig.length || newSheets(a) - newSheets(b) || a.apart.length - b.apart.length || a.waste - b.waste || a.ripWidths - b.ripWidths)
  return tries[0]
}

// ---- Lumber: rip strips from a board's width, crosscut along its length; buy the lengths that waste least ----
export type LumberBoard = { length: number; strips: { width: number; parts: { piece: Piece; y: number; l: number }[]; used: number }[]; cuts: string[] }
export type LumberResult = { boards: LumberBoard[]; tooBig: Piece[] }

export function packLumber(pieces: Piece[], wood: Wood, kerf: number, endTrim: number): LumberResult {
  const lengths = [...(wood.availableLengths?.length ? wood.availableLengths : [wood.length])].sort((a, b) => a - b)
  const maxL = lengths[lengths.length - 1] - 2 * endTrim
  const tooBig = pieces.filter(p => p.w > wood.width + EPS || p.l > maxL + EPS)
  const ok = pieces.filter(p => !tooBig.includes(p))
  const boards: LumberBoard[] = []
  // Each width class: how many strips one board gives, then first-fit-decreasing into strips.
  const widths = [...new Set(ok.map(p => (p.w >= wood.width - 1 / 64 ? wood.width : p.w)))].sort((a, b) => b - a)
  for (const w of widths) {
    const full = w >= wood.width - EPS
    const k = full ? 1 : Math.max(1, Math.floor((wood.width + kerf) / (w + kerf)))
    const strips: { width: number; parts: { piece: Piece; y: number; l: number }[]; used: number }[] = []
    for (const p of ok.filter(q => (q.w >= wood.width - 1 / 64 ? wood.width : q.w) === w).sort((a, b) => b.l - a.l)) {
      const s = strips.find(st => st.used + kerf + p.l <= maxL + EPS)
      if (s) { s.parts.push({ piece: p, y: s.used + kerf, l: p.l }); s.used += kerf + p.l }
      else strips.push({ width: w, parts: [{ piece: p, y: 0, l: p.l }], used: p.l })
    }
    for (let i = 0; i < strips.length; i += k) {
      const set = strips.slice(i, i + k)
      const need = Math.max(...set.map(st => st.used)) + 2 * endTrim
      const length = lengths.find(l => l >= need - EPS) ?? lengths[lengths.length - 1]
      const cuts = full
        ? [`Crosscut: ${set[0].parts.map(q => `${formatInches(q.l)} (P${q.piece.no} ${q.piece.name})`).join(', ')}`]
        : [`Rip ${set.length} strip${set.length === 1 ? '' : 's'} ${formatInches(w)} wide`, ...set.map((st, j) => `Strip ${j + 1}: crosscut ${st.parts.map(q => `${formatInches(q.l)} (P${q.piece.no} ${q.piece.name})`).join(', ')}`)]
      boards.push({ length, strips: set, cuts })
    }
  }
  return { boards, tooBig }
}

// ---- The whole design ----
export type ShopStockItem = { id: string; woodId: string; kind: 'sheet' | 'offcut' | 'board'; width: number; length: number; defects?: { from: number; to: number }[]; note?: string }
export type WoodLayout =
  | { wood: Wood; kind: 'sheet' | 'hardwood'; result: PackResult; kerf: number; glued: Piece[] }
  | { wood: Wood; kind: 'lumber'; result: LumberResult; kerf: number }

/** Shop stock as pieces to cut from: a board with defects becomes the clear stretches between them. */
export function shopStockFor(items: ShopStockItem[], w: Wood, edgeTrim: number, endTrim: number): Stock[] {
  const out: Stock[] = []
  for (const it of items.filter(i => i.woodId === w.id)) {
    const label = it.kind === 'sheet' ? 'Your sheet' : it.kind === 'offcut' ? 'Your offcut' : 'Your board'
    const segs = stretches(it)
    for (const { id, from: a, to: b } of segs) out.push({ id, label: `${label} ${formatInches(it.width)} × ${formatInches(it.length)}${segs.length > 1 ? ` (clear ${formatInches(a)}–${formatInches(b)})` : ''}`, w: it.width, l: b - a, edgeTrim: it.kind === 'offcut' ? 0 : edgeTrim, endTrim: it.kind === 'offcut' ? 0 : endTrim, fromShop: it.id })
  }
  return out
}

/** The clear stretches of a stock item, with their stock ids (as shopStockFor names them). */
function stretches(it: ShopStockItem): { id: string; from: number; to: number }[] {
  const defects = [...(it.defects ?? [])].sort((a, b) => a.from - b.from)
  let at = 0
  const segs: [number, number][] = []
  for (const d of defects) { if (d.from > at) segs.push([at, d.from]); at = Math.max(at, d.to) }
  if (at < it.length) segs.push([at, it.length])
  return segs.map(([a, b], k) => ({ id: `${it.id}${segs.length > 1 ? `#${k + 1}` : ''}`, from: a, to: b }))
}

/**
 * Shop stock after cutting: each clear stretch that was used goes, leaving its offcut (if any); the stretches of
 * the same board that weren't used stay as boards.
 */
export function stockAfterUse(items: ShopStockItem[], used: { stockId: string; left?: { width: number; length: number } }[], id: () => string = () => Math.random().toString(36).slice(2)): ShopStockItem[] {
  const byStock = new Map(used.map(u => [u.stockId, u]))
  return items.flatMap(it => {
    const segs = stretches(it)
    if (!segs.some(s => byStock.has(s.id))) return [it]
    return segs.flatMap(s => {
      const u = byStock.get(s.id)
      if (!u) return [{ id: id(), woodId: it.woodId, kind: it.kind, width: it.width, length: s.to - s.from, ...(it.note ? { note: it.note } : {}) }]
      const l = u.left
      return l && l.width >= 1 && l.length >= 1 ? [{ id: id(), woodId: it.woodId, kind: 'offcut' as const, width: l.width, length: l.length }] : []
    })
  })
}

/** Layouts for every wood in the design. */
export function layoutAll(p: Project, shop: ShopStockItem[] = []): WoodLayout[] {
  const pieces = piecesOf(p)
  const useShop = p.cutSettings?.useStock ?? false
  const out: WoodLayout[] = []
  for (const w of p.woods) {
    const mine = pieces.filter(q => q.woodId === w.id)
    if (!mine.length) continue
    const s = settingsFor(p, w)
    const stock = useShop ? shopStockFor(shop, w, s.edgeTrim, s.endTrim) : []
    if (w.kind === 'sheet') {
      out.push({ wood: w, kind: 'sheet', kerf: s.kerf, glued: [], result: packSheets(mine, { label: 'Sheet', w: w.width, l: w.length, edgeTrim: s.edgeTrim, endTrim: s.endTrim }, s.kerf, stock) })
    } else if (w.kind === 'lumber') {
      out.push({ wood: w, kind: 'lumber', kerf: s.kerf, result: packLumber(mine, w, s.kerf, s.endTrim) })
    } else {
      // Rough hardwood: random-width boards. A part wider than a board is glued up from strips.
      const hb = p.cutSettings?.hardwoodBoard ?? HARDWOOD_BOARD
      const usable = hb.width - 2 * s.edgeTrim
      const glued: Piece[] = []
      const split = mine.flatMap(q => {
        if (q.w <= usable + EPS) return [q]
        // Too narrow a board to rip glue-up strips from: the packer reports the part as too big.
        if (usable - 0.125 <= 0.25) return [q]
        glued.push(q)
        const n = Math.ceil(q.w / (usable - 0.125))
        return Array.from({ length: n }, (_, i) => ({ ...q, name: `${q.name} (strip ${i + 1} of ${n})`, w: q.w / n + 0.125 }))
      })
      out.push({ wood: w, kind: 'hardwood', kerf: s.kerf, glued, result: packSheets(split, { label: `Board ${formatInches(hb.width)} × ${formatInches(hb.length)}`, w: hb.width, l: hb.length, edgeTrim: s.edgeTrim, endTrim: s.endTrim }, s.kerf, stock) })
    }
  }
  return out
}

/** Rough thickness to buy for a surfaced thickness: 3/4" → 4/4 (1"), 1" → 5/4, 1-3/4" → 8/4. */
export function roughThickness(t: number): number {
  // Rough hardwood comes 4/4 and up.
  return Math.max(1, Math.ceil((t + 0.1875) * 4 - 1e-9) / 4)
}
