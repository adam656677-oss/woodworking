// The shopping list: sheets, lumber by length, hardwood by the board foot, edge banding and hardware, with costs.
import { finishById } from '../finish/finishes'
import { hardwareList } from '../cabinet/hardware'
import { joineryHardware } from '../joinery/cuts'
import type { Project } from '../model/types'
import { formatInches } from '../model/units'
import { BANDINGS, bandingInches } from './banding'
import { layoutAll, roughThickness, type ShopStockItem } from './layout'
import { HARDWOOD_WASTE } from './settings'

/** `unpriced`: the app keeps no price for it (joint hardware, finishes), so it isn't counted as a missing price. */
export type BuyLine = { section: 'wood' | 'banding' | 'hardware' | 'finish'; what: string; qty: number; unit: string; each?: number; total?: number; unpriced?: boolean }
export type ShoppingList = { lines: BuyLine[]; subtotal: number; byKind: Record<BuyLine['section'], number>; missing: number; tax: number; total: number }

const money = (n: number) => Math.round(n * 100) / 100

/** `onHand`: hardware and finishes already in the shop (the shop journal's inventory) — bought only what's short. */
export function shoppingList(p: Project, shop: ShopStockItem[] = [], onHand?: { hardware: { itemId: string; qty: number }[]; finishes: { finishId?: string; amount: number }[] }): ShoppingList {
  const lines: BuyLine[] = []
  for (const l of layoutAll(p, shop)) {
    const w = l.wood
    if (l.kind === 'sheet') {
      const n = l.result.sheets.filter(s => !s.stock.fromShop).length
      if (n) lines.push({ section: 'wood', what: `${w.name} (${formatInches(w.width)} × ${formatInches(w.length)} sheet)`, qty: n, unit: 'sheet', ...(w.pricePerSheet !== undefined ? { each: w.pricePerSheet, total: money(n * w.pricePerSheet) } : {}) })
    } else if (l.kind === 'lumber') {
      const byLen = new Map<number, number>()
      for (const b of l.result.boards) byLen.set(b.length, (byLen.get(b.length) ?? 0) + 1)
      for (const [len, n] of [...byLen].sort((a, b) => a[0] - b[0])) {
        const each = w.pricePerPiece?.[String(len)] ?? (w.pricePerBoardFoot !== undefined ? money(Math.ceil(w.thickness + 0.25) * Math.ceil(w.width + 0.25) * len / 144 * w.pricePerBoardFoot) : undefined)
        lines.push({ section: 'wood', what: `${w.name} × ${len / 12}'`, qty: n, unit: 'board', ...(each !== undefined ? { each, total: money(n * each) } : {}) })
      }
    } else {
      // Rough hardwood: board feet of the boards the layout uses, plus waste.
      const t = roughThickness(w.thickness)
      const bf = l.result.sheets.filter(s => !s.stock.fromShop).reduce((n, s) => n + (t * s.stock.w * s.stock.l) / 144, 0)
      const waste = p.cutSettings?.hardwoodWaste ?? HARDWOOD_WASTE
      const qty = Math.ceil(bf * (1 + waste) * 10) / 10
      if (qty > 0) lines.push({ section: 'wood', what: `${w.species === 'Hardwood' ? w.name : `${w.species} ${w.name}`} — ${t * 4}/4 rough (incl. ${Math.round(waste * 100)}% waste)`, qty, unit: 'bd ft', ...(w.pricePerBoardFoot !== undefined ? { each: w.pricePerBoardFoot, total: money(qty * w.pricePerBoardFoot) } : {}) })
    }
  }
  for (const [id, inches] of bandingInches(p)) {
    const band = BANDINGS.find(b => b.id === id)
    const feet = Math.ceil((inches / 12) * 1.1)
    lines.push({ section: 'banding', what: `${band?.name ?? id} (incl. 10% extra)`, qty: feet, unit: 'ft', ...(band ? { each: band.pricePerFoot, total: money(feet * band.pricePerFoot) } : {}) })
  }
  // Hardware: what the shop already has is taken off (across rows of the same item, in order).
  const have = new Map<string, number>()
  for (const h of onHand?.hardware ?? []) have.set(h.itemId, (have.get(h.itemId) ?? 0) + h.qty)
  for (const r of hardwareList(p).rows) {
    const owned = have.get(r.itemId) ?? 0
    const glass = r.note !== undefined && /^[\d.]+ × [\d.]+$/.test(r.note)
    if (!owned || glass) { lines.push({ section: 'hardware', what: r.name + (r.note ? ` — ${r.note}` : ''), qty: r.qty, unit: 'each', each: r.unit, total: r.total }); continue }
    const use = Math.min(owned, r.qty)
    have.set(r.itemId, owned - use)
    const buy = r.qty - use
    lines.push({ section: 'hardware', what: `${r.name}${r.note ? ` — ${r.note}` : ''} (${use} from your shop; this project needs ${r.qty}${buy ? ` — buy ${buy}` : ''})`, qty: buy, unit: 'each', each: r.unit, total: money(buy * r.unit) })
  }
  // What goes in the cut joints: dowels, biscuits, loose tenons, splines (no price kept for these).
  for (const h of joineryHardware(p)) lines.push({ section: 'hardware', what: `${h.what} (for the joints)`, qty: h.qty, unit: 'each', unpriced: true })
  // Finishes in the finishing schedule, unless the shop has some.
  const finishes = [...new Set((p.finish?.steps ?? []).map(s => s.finishId).filter((x): x is string => !!x))]
  for (const id of finishes) {
    const f = finishById(id)
    if (!f) continue
    const got = (onHand?.finishes ?? []).filter(x => x.finishId === id).reduce((s, x) => s + x.amount, 0)
    lines.push({ section: 'finish', what: got > 0 ? `${f.name} (you have some — check there's enough)` : f.name, qty: got > 0 ? 0 : 1, unit: 'can' })
  }
  const byKind: ShoppingList['byKind'] = { wood: 0, banding: 0, hardware: 0, finish: 0 }
  let missing = 0
  for (const l of lines) { if (l.total === undefined) { if (l.qty > 0 && l.section !== 'finish' && !l.unpriced) missing++ } else byKind[l.section] += l.total }
  for (const k of Object.keys(byKind) as BuyLine['section'][]) byKind[k] = money(byKind[k])
  const subtotal = money(Object.values(byKind).reduce((a, b) => a + b, 0))
  const tax = money(subtotal * ((p.cutSettings?.tax ?? 0) / 100))
  return { lines, subtotal, byKind, missing, tax, total: money(subtotal + tax) }
}
