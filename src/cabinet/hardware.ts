// The hardware library (hinges, slides, pulls, screws, pins, glass) and a design's hardware list.
import { groupBoardIds, groupsOf, groupsWithParts } from '../assemblies/ops'
import { newId } from '../model/ids'
import type { HardwareItem, HardwareUse, Project } from '../model/types'

/** Built-in items with typical prices (editable per project). */
export const HARDWARE: readonly HardwareItem[] = Object.freeze([
  { id: 'hinge-full', name: 'Concealed hinge, full overlay (35 mm)', kind: 'hinge', price: 4.5 },
  { id: 'hinge-half', name: 'Concealed hinge, half overlay (35 mm)', kind: 'hinge', price: 4.5 },
  { id: 'hinge-inset', name: 'Concealed hinge, inset (35 mm)', kind: 'hinge', price: 5 },
  { id: 'hinge-butt', name: 'Butt hinge 2-1/2"', kind: 'hinge', price: 3 },
  ...[10, 12, 14, 16, 18, 20, 22, 24, 26, 28].map(l => ({ id: `slide-side-${l}`, name: `Side-mount ball-bearing slides ${l}" (pair)`, kind: 'slide' as const, price: 12 + l * 0.5 })),
  ...[12, 15, 18, 21].map(l => ({ id: `slide-under-${l}`, name: `Undermount soft-close slides ${l}" (pair)`, kind: 'slide' as const, price: 28 + l })),
  { id: 'knob', name: 'Knob 1-1/4"', kind: 'pull', price: 3 },
  { id: 'pull-3', name: 'Bar pull 3" centres', kind: 'pull', price: 4 },
  { id: 'pull-96', name: 'Bar pull 96 mm centres', kind: 'pull', price: 5 },
  { id: 'pull-128', name: 'Bar pull 128 mm centres', kind: 'pull', price: 6 },
  { id: 'pull-160', name: 'Bar pull 160 mm centres', kind: 'pull', price: 7 },
  { id: 'screw-6-58', name: 'Wood screws #6 × 5/8"', kind: 'screw', price: 0.05 },
  { id: 'screw-8-114', name: 'Wood screws #8 × 1-1/4"', kind: 'screw', price: 0.08 },
  { id: 'pocket-114', name: 'Pocket screws 1-1/4" coarse', kind: 'screw', price: 0.07 },
  { id: 'pin-5mm', name: 'Shelf pins 5 mm', kind: 'pin', price: 0.25 },
  { id: 'tabletop-fastener', name: 'Tabletop fasteners (figure-8)', kind: 'other', price: 0.6 },
  { id: 'pin-14', name: 'Shelf pins 1/4"', kind: 'pin', price: 0.25 },
  { id: 'glass-18', name: 'Glass 1/8" (per sq ft)', kind: 'glass', price: 9 }
])

/** Bar pull centre-to-centre sizes (inches) by item. */
export const PULL_CC: Record<string, number> = { 'pull-3': 3, 'pull-96': 96 / 25.4, 'pull-128': 128 / 25.4, 'pull-160': 160 / 25.4 }

/** Every item the project can use: built-ins (with its price changes) and its own. */
export function hardwareItems(p: Project): HardwareItem[] {
  const own = new Map((p.hardwareItems ?? []).map(h => [h.id, h]))
  return [...HARDWARE.map(h => own.get(h.id) ?? h), ...(p.hardwareItems ?? []).filter(h => !HARDWARE.some(b => b.id === h.id))]
}
export const itemOf = (p: Project, id: string) => hardwareItems(p).find(h => h.id === id)

export function addHardware(p: Project, use: Omit<HardwareUse, 'id'>): Project {
  return { ...p, hardware: [...(p.hardware ?? []), { ...use, id: newId('p') }] }
}
export function setHardwareQty(p: Project, id: string, qty: number): Project {
  if (!(qty > 0)) return removeHardware(p, id)
  return { ...p, hardware: (p.hardware ?? []).map(h => (h.id === id ? { ...h, qty: Math.round(qty) } : h)) }
}
export function removeHardware(p: Project, id: string): Project {
  const hardware = (p.hardware ?? []).filter(h => h.id !== id)
  if (hardware.length) return { ...p, hardware }
  const { hardware: _h, ...rest } = p
  return rest
}
/** Changes an item's price (a built-in's change is kept with the project). */
export function setItemPrice(p: Project, itemId: string, price: number): Project {
  const item = itemOf(p, itemId)
  if (!item || !(price >= 0)) return p
  const own = (p.hardwareItems ?? []).filter(h => h.id !== itemId)
  return { ...p, hardwareItems: [...own, { ...item, price }] }
}
export function addItem(p: Project, item: Omit<HardwareItem, 'id'>): { project: Project; id: string } {
  const id = newId('p')
  return { project: { ...p, hardwareItems: [...(p.hardwareItems ?? []), { ...item, id }] }, id }
}

/** Hardware whose part or group is gone goes with it. */
export function pruneHardware(p: Project): Project {
  if (!p.hardware?.length) return p
  // A group counts while it still has parts.
  const groups = groupsWithParts(p), boards = new Set(p.boards.map(b => b.id))
  const keep = p.hardware.filter(h => (!h.groupId || groups.has(h.groupId)) && (!h.boardId || boards.has(h.boardId)))
  if (keep.length === p.hardware.length) return p
  return keep.length ? { ...p, hardware: keep } : (({ hardware: _h, ...rest }) => rest)(p)
}

export type HardwareRow = { useIds: string[]; itemId: string; name: string; qty: number; where: string; unit: number; total: number; note?: string }

/** The hardware list: one row per item and note (glass by size), with where it goes and the cost. */
export function hardwareList(p: Project): { rows: HardwareRow[]; total: number } {
  const groupName = (id?: string) => groupsOf(p).find(g => g.id === id)?.name
  const boardName = (id?: string) => p.boards.find(b => b.id === id)?.name
  const rows: HardwareRow[] = []
  for (const h of p.hardware ?? []) {
    const item = itemOf(p, h.itemId)
    if (!item) continue
    const where = groupName(h.groupId) ?? boardName(h.boardId) ?? ''
    const row = rows.find(r => r.itemId === h.itemId && r.note === h.note && item.kind !== 'glass')
    if (row) {
      row.qty += h.qty
      row.useIds.push(h.id)
      if (where && !row.where.split(', ').includes(where)) row.where = row.where ? `${row.where}, ${where}` : where
    } else rows.push({ useIds: [h.id], itemId: item.id, name: item.name, qty: h.qty, where, unit: item.price, total: 0, ...(h.note ? { note: h.note } : {}) })
  }
  for (const r of rows) {
    // Glass is priced by area: its note is "W × H" in inches.
    const m = r.note && itemOf(p, r.itemId)?.kind === 'glass' ? /^([\d.]+) × ([\d.]+)$/.exec(r.note) : null
    const qty = m ? (Number(m[1]) * Number(m[2]) / 144) * r.qty : r.qty
    r.total = Math.round(qty * r.unit * 100) / 100
  }
  return { rows, total: Math.round(rows.reduce((s, r) => s + r.total, 0) * 100) / 100 }
}
