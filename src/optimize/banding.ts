// Edge banding: built-in bandings, which edges a part has banded, and the cut size it leaves.
import type { Banding, Board, Project } from '../model/types'
import { formatInches } from '../model/units'

export type BandItem = { id: string; name: string; thickness: number; width: number; pricePerFoot: number; colour: string }
export const BANDINGS: readonly BandItem[] = Object.freeze([
  { id: 'band-birch', name: 'Birch veneer banding 3/4"', thickness: 0.02, width: 0.8125, pricePerFoot: 0.35, colour: '#e3c9a0' },
  { id: 'band-oak', name: 'Red oak veneer banding 3/4"', thickness: 0.02, width: 0.8125, pricePerFoot: 0.4, colour: '#c9955f' },
  { id: 'band-maple', name: 'Maple veneer banding 3/4"', thickness: 0.02, width: 0.8125, pricePerFoot: 0.38, colour: '#ead7b5' },
  { id: 'band-pvc', name: 'White PVC banding 0.5 mm', thickness: 0.5 / 25.4, width: 0.875, pricePerFoot: 0.25, colour: '#f5f5f4' },
  { id: 'band-wood', name: 'Solid wood banding 1/32"', thickness: 1 / 32, width: 0.8125, pricePerFoot: 0.6, colour: '#c08a52' }
])
export const bandOf = (id: string) => BANDINGS.find(b => b.id === id)

const EDGE_NAMES: Record<Banding['edges'][number], string> = { left: 'left edge', right: 'right edge', start: 'start end', end: 'far end' }

/** Banding thick enough to matter (1/32" or more) comes off the part's cut size. */
export function cutSize(b: Board): { width: number; length: number } {
  const t = b.banding ? bandOf(b.banding.bandId)?.thickness ?? 0 : 0
  if (!b.banding || t < 1 / 32 - 1e-9) return { width: b.width, length: b.length }
  const n = (e: Banding['edges'][number]) => (b.banding!.edges.includes(e) ? t : 0)
  return { width: b.width - n('left') - n('right'), length: b.length - n('start') - n('end') }
}

/** "Band left & right edges (Birch veneer banding 3/4")". */
export function bandingNote(b: Board): string | null {
  if (!b.banding?.edges.length) return null
  const band = bandOf(b.banding.bandId)
  const e = b.banding.edges
  const both = (a: string, c: string) => e.includes(a as never) && e.includes(c as never)
  const parts: string[] = []
  if (both('left', 'right')) parts.push('both long edges'); else for (const x of ['left', 'right'] as const) if (e.includes(x)) parts.push(EDGE_NAMES[x])
  if (both('start', 'end')) parts.push('both ends'); else for (const x of ['start', 'end'] as const) if (e.includes(x)) parts.push(EDGE_NAMES[x])
  return `Band ${parts.join(' & ')} (${band?.name ?? 'banding'})`
}

/** Banding needed by type: linear inches over every part. */
export function bandingInches(p: Project): Map<string, number> {
  const out = new Map<string, number>()
  for (const b of p.boards) {
    if (!b.banding) continue
    const len = b.banding.edges.reduce((s, e) => s + (e === 'left' || e === 'right' ? b.length : b.width), 0)
    out.set(b.banding.bandId, (out.get(b.banding.bandId) ?? 0) + len)
  }
  return out
}

export function setBanding(p: Project, ids: string[], banding: Banding | null): Project {
  return { ...p, boards: p.boards.map(b => (!ids.includes(b.id) ? b : banding && banding.edges.length ? { ...b, banding } : (({ banding: _b, ...rest }) => rest)(b))) }
}

export const cutSizeText = (b: Board) => { const c = cutSize(b); return `${formatInches(c.width)} × ${formatInches(c.length)}` }
