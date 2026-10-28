// The cut list: every part grouped, with sizes, notes, board feet, sheet counts and cost.
import { jointNotes } from './joints'
import type { Project } from './types'
import { formatInches } from './units'
import { boardFeet, findWood } from './woods'

export type CutListRow = {
  qty: number
  part: string
  thickness: number
  width: number
  length: number
  woodName: string
  grain: 'length' | 'width'
  notes: string[]
}

export type CutListTotals = {
  boardFeetByWood: Record<string, number>
  sheetsByWood: Record<string, number>
  cost?: number
}

export const SHEET_AREA = 48 * 96

type Group = CutListRow & { woodId: string; names: string[] }

export function cutList(project: Project): { rows: CutListRow[]; totals: CutListTotals } {
  const groups = new Map<string, Group>()
  for (const b of project.boards) {
    const notes = jointNotes(project, b.id)
    const key = JSON.stringify([b.woodId, b.thickness, b.width, b.length, b.grain, notes])
    const g = groups.get(key)
    if (g) {
      g.qty += 1
      if (!g.names.includes(b.name)) g.names.push(b.name)
    } else {
      const wood = findWood(project, b.woodId)
      groups.set(key, {
        qty: 1, part: '', thickness: b.thickness, width: b.width, length: b.length,
        woodName: wood?.name ?? 'Unknown wood', grain: b.grain, notes, woodId: b.woodId, names: [b.name]
      })
    }
  }
  const all = [...groups.values()]
  all.sort((a, b) => a.woodName.localeCompare(b.woodName) || b.thickness - a.thickness || b.length - a.length)

  const boardFeetByWood: Record<string, number> = {}
  const areaByWood: Record<string, number> = {}
  const usedWoodIds = new Set<string>()
  for (const g of all) {
    usedWoodIds.add(g.woodId)
    const wood = findWood(project, g.woodId)
    if (wood?.kind === 'sheet') areaByWood[g.woodName] = (areaByWood[g.woodName] ?? 0) + g.width * g.length * g.qty
    else boardFeetByWood[g.woodName] = (boardFeetByWood[g.woodName] ?? 0) + boardFeet(g.thickness, g.width, g.length) * g.qty
  }
  const sheetsByWood: Record<string, number> = {}
  for (const [name, area] of Object.entries(areaByWood)) sheetsByWood[name] = Math.ceil(area / SHEET_AREA - 1e-9)

  let cost: number | undefined = 0
  for (const id of usedWoodIds) {
    const wood = findWood(project, id)
    if (!wood) { cost = undefined; break }
    if (wood.kind === 'sheet') {
      if (wood.pricePerSheet === undefined) { cost = undefined; break }
      cost += wood.pricePerSheet * (sheetsByWood[wood.name] ?? 0)
    } else {
      if (wood.pricePerBoardFoot === undefined) { cost = undefined; break }
      cost += wood.pricePerBoardFoot * (boardFeetByWood[wood.name] ?? 0)
    }
  }
  if (all.length === 0) cost = undefined

  const rows: CutListRow[] = all.map(({ woodId: _w, names, ...r }) => ({ ...r, part: names.join(' / ') }))
  const totals: CutListTotals = { boardFeetByWood, sheetsByWood }
  if (cost !== undefined) totals.cost = Math.round(cost * 100) / 100
  return { rows, totals }
}

function csvField(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function cutListCsv(project: Project): string {
  const lines = ['Qty,Part,Thickness,Width,Length,Wood,Grain,Notes']
  for (const r of cutList(project).rows) {
    lines.push(
      [r.qty, r.part, formatInches(r.thickness), formatInches(r.width), formatInches(r.length), r.woodName, r.grain, r.notes.join('; ')]
        .map(csvField)
        .join(',')
    )
  }
  return lines.join('\n') + '\n'
}
