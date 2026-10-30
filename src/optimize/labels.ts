// Part labels for Avery sheets, each with a QR code (made here, offline).
import qrcode from 'qrcode-generator'
import type { Project } from '../model/types'
import { formatInches } from '../model/units'
import { bandOf, cutSize } from './banding'
import { partNumbers } from './pieces'

/** The QR text uses | between fields, so a | in a name becomes / . */
const bar = (t: string) => t.replace(/\|/g, '/')

export type LabelSheet = { id: '5160' | '5163'; name: string; cols: number; rows: number; w: number; h: number; top: number; left: number; pitchX: number; pitchY: number }
export const LABEL_SHEETS: Record<LabelSheet['id'], LabelSheet> = {
  '5160': { id: '5160', name: 'Avery 5160 (30 per sheet, 2-5/8" × 1")', cols: 3, rows: 10, w: 2.625, h: 1, top: 0.5, left: 0.1875, pitchX: 2.75, pitchY: 1 },
  '5163': { id: '5163', name: 'Avery 5163 (10 per sheet, 4" × 2")', cols: 2, rows: 5, w: 4, h: 2, top: 0.5, left: 0.15625, pitchX: 4.1875, pitchY: 2 }
}

export type Label = { no: number; name: string; size: string; wood: string; grain: 'length' | 'width'; banding?: string; qr: string; project: string }

/** "23-3/4 x 9-1/4 x 3/4" (no inch marks, so it scans cleanly). */
const plain = (v: number) => formatInches(v).replace(/"/g, '')

/** One label per part (copies of the same part share a number). */
export function labelsFor(p: Project): Label[] {
  const nos = partNumbers(p)
  return [...p.boards].sort((a, b) => (nos.get(a.id) ?? 0) - (nos.get(b.id) ?? 0)).map(b => {
    const no = nos.get(b.id) ?? 0
    const wood = p.woods.find(w => w.id === b.woodId)?.name ?? b.woodId
    const c = cutSize(b)
    const banding = b.banding ? `Banded: ${b.banding.edges.join(', ')} (${bandOf(b.banding.bandId)?.name ?? 'banding'})` : undefined
    return {
      no, name: b.name, size: `${formatInches(b.length)} × ${formatInches(b.width)} × ${formatInches(b.thickness)}`, wood, grain: b.grain, project: p.name,
      ...(banding ? { banding } : {}),
      qr: `AAWS|${bar(p.name)}|P${no}|${bar(b.name)}|${plain(c.length)} x ${plain(c.width)} x ${plain(b.thickness)}`
    }
  })
}

/** A QR code as dark-module coordinates (error correction M), and its size in modules. */
export function qrModules(text: string): { size: number; dark: [number, number][] } {
  const q = qrcode(0, 'M')
  q.addData(text, 'Byte')
  q.make()
  const size = q.getModuleCount()
  const dark: [number, number][] = []
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (q.isDark(r, c)) dark.push([c, r])
  return { size, dark }
}

/** Where each label goes: page, and its top-left corner on the page (inches). */
export function labelPositions(n: number, sheet: LabelSheet, skip = 0): { page: number; x: number; y: number }[] {
  const per = sheet.cols * sheet.rows
  return Array.from({ length: n }, (_, i) => {
    const k = i + skip
    const slot = k % per
    return { page: Math.floor(k / per), x: sheet.left + (slot % sheet.cols) * sheet.pitchX, y: sheet.top + Math.floor(slot / sheet.cols) * sheet.pitchY }
  })
}
