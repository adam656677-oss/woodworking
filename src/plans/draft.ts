// Turning the text of a plan (from a PDF or the text reader) into a draft: name, steps, cut list,
// tools and materials. Every drafted item starts "check me" and remembers the line it came from.
import { newId } from '../model/ids'
import { metricToInches, NOMINAL, parseDim } from './dims'
import { newPlan, type CutRow, type Material, type Plan, type PlanStep, type ReviewRef, type TextLine } from './types'

export type Draft = { plan: Plan; flags: Record<string, string>; notes: string[] }

// One written size: 11-1/4, 11 1/4, 3/4, 5½, 5.5, 450mm — with an optional inch, foot or metric unit.
const NUM = String.raw`(?:\d+\s*-\s*\d+/\d+|\d+\s+\d+/\d+|\d+/\d+|\d*[¼½¾⅛⅜⅝⅞]|\d+(?:\.\d+)?)`
const DIM = String.raw`${NUM}\s*(?:mm|cm|"|''|'|in\b)?`
const X = String.raw`\s*x\s*`
const THREE = String.raw`(${DIM})${X}(${DIM})${X}(${DIM})`

const HEADINGS = /^(cut ?list|cutting list|materials?|supplies|hardware|tools?|instructions|directions|steps|assembly|lumber)\b/i
const MATERIAL_WORDS = /\b(screws?|nails?|glue|hinges?|pulls?|knobs?|slides?|finish|stain|paint|sandpaper|dowels?|biscuits?|brads?|bolts?|washers?|wood filler)\b/i

/** Read one size token; metric is converted and reported. */
function dim(token: string): { value: number | null; metric: boolean } {
  const t = token.trim()
  const m = /^(\d+(?:\.\d+)?)\s*(mm|cm)$/i.exec(t)
  if (m) return { value: metricToInches(Number(m[1]), m[2].toLowerCase() as 'mm' | 'cm'), metric: true }
  return { value: parseDim(t.replace(/''$/, '"')), metric: false }
}

/** OCR reads × as X, % or *; and drops "?" into numbers it doubts. */
function normalize(text: string): string {
  return text
    .replace(/[×*%]/g, ' x ')
    .replace(/(\d|["'])\s*X\s*(?=\d)/g, '$1 x ')
    .replace(/(\d)X(?=\s|$)/g, '$1 x')
    // "%x" or "X%" becomes "x x": two separators in a row are one.
    .replace(/(?:\s*\bx\b\s*){2,}/g, ' x ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

const cleanPart = (s: string) => s.replace(/^[\s:,-]+|[\s:,.-]+$/g, '').replace(/^["']|["']$/g, '').trim()

type RowMatch = { qty: number; part: string; dims: string[]; wood: string; flag?: string }

/** Recognise one cut-list line in any of the common written forms. */
function matchRow(raw: string): RowMatch | null {
  const t = normalize(raw.replace(/\?/g, ''))
  let m: RegExpExecArray | null
  // (2) 1x6 @ 24" Aprons   /   2) 1x4 @ 14-1/2"
  if ((m = new RegExp(String.raw`^\(?(\d+)\)?\s*(\d)\s*x\s*(\d{1,2})\s*@\s*(${DIM})(.*)$`, 'i').exec(t))) {
    const nominal = `${m[2]}x${m[3]}`
    if (!NOMINAL[nominal]) return null
    const [th, w] = NOMINAL[nominal]
    return { qty: Number(m[1]), part: cleanPart(m[5]), dims: [String(th), String(w), m[4]], wood: nominal }
  }
  // 2 - 3/4 x 5-1/2 x 24" Sides   (quantity, spaced dash, three sizes)
  if ((m = new RegExp(String.raw`^\(?(\d+)\)?\s+-\s+${THREE}(.*)$`, 'i').exec(t))) {
    return { qty: Number(m[1]), part: cleanPart(m[5]), dims: [m[2], m[3], m[4]], wood: '' }
  }
  // 2-3/4x11-1/4x9" Legs — the reader ate the spaces around the quantity dash.
  if ((m = new RegExp(String.raw`^(\d{1,2})-(\d+/\d+)${X}(${DIM})${X}(${DIM})(.*)$`, 'i').exec(t))) {
    return {
      qty: Number(m[1]), part: cleanPart(m[5]), dims: [m[2], m[3], m[4]], wood: '',
      flag: `check me — read as ${m[1]} pieces ${m[2]}" thick; it could be one piece ${m[1]}-${m[2]}" thick`
    }
  }
  // Top: 3/4" x 11-1/4" x 16"
  if ((m = new RegExp(String.raw`^([A-Za-z][\w '/-]*?)\s*:\s*${THREE}(.*)$`, 'i').exec(t))) {
    return { qty: 1, part: cleanPart(m[1]), dims: [m[2], m[3], m[4]], wood: '' }
  }
  // 2 Sides 3/4 x 11 1/4 x 30 1/2
  if ((m = new RegExp(String.raw`^(\d+)\s+([A-Za-z][A-Za-z '/-]*?)\s+${THREE}(.*)$`, 'i').exec(t))) {
    return { qty: Number(m[1]), part: cleanPart(m[2]), dims: [m[3], m[4], m[5]], wood: '' }
  }
  return null
}

/** A table row under a Qty / Part / T / W / L header: qty, part words, then three sizes. */
function matchTableRow(raw: string): RowMatch | null {
  const tokens = normalize(raw).split(' ')
  if (tokens.length < 5 || !/^\d+$/.test(tokens[0])) return null
  const dims = tokens.slice(-3)
  if (!dims.every(d => dim(d).value !== null)) return null
  const part = tokens.slice(1, -3).join(' ')
  return part ? { qty: Number(tokens[0]), part, dims, wood: '' } : null
}

const isTableHeader = (t: string) => /\b(qty|quantity)\b/i.test(t) && /\b(part|name|description|piece)\b/i.test(t) && /\b(t|w|l|thick\w*|width|length|size)\b/i.test(t)

function stepStart(t: string): { n: number; text: string } | null {
  const m = /^(?:step\s*)?(\d{1,2})\s*[.):]\s*(.*)$/i.exec(t) ?? /^step\s+(\d{1,2})\s*[-:.]?\s*(.*)$/i.exec(t)
  return m ? { n: Number(m[1]), text: m[2].trim() } : null
}

/** Draft a plan from its text lines. `toolNames` maps lower-case tool names and aliases to tool ids. */
export function draftPlan(lines: TextLine[], toolNames: Record<string, string>): Draft {
  const plan = newPlan('Imported plan', newId('p'))
  const flags: Record<string, string> = {}
  const notes: string[] = []
  const review: ReviewRef[] = []
  const ref = (itemId: string, l: TextLine) => review.push({ itemId, page: l.page, box: l.box })

  // Name: the biggest text on the first page (or its first line).
  const first = lines.filter(l => l.page === Math.min(...lines.map(x => x.page)))
  const nameLine = first.some(l => l.size) ? first.reduce((a, b) => ((b.size ?? 0) > (a.size ?? 0) ? b : a)) : first[0]
  if (nameLine) plan.name = nameLine.text.trim()
  const bodySize = (() => {
    const sizes = lines.map(l => l.size).filter((s): s is number => !!s).sort((a, b) => a - b)
    return sizes.length ? sizes[Math.floor(sizes.length / 2)] : undefined
  })()
  const isHeading = (l: TextLine) => HEADINGS.test(l.text.trim()) && l.text.trim().split(' ').length <= 3

  const steps: { step: PlanStep; n: number }[] = []
  const rows: CutRow[] = []
  const materials: Material[] = []
  const tools: string[] = []
  const description: string[] = []
  let section: 'intro' | 'tools' | 'materials' | 'cut' | 'steps' = 'intro'
  let inTable = false
  let current: PlanStep | null = null

  const addRow = (r: RowMatch, l: TextLine) => {
    const parsed = r.dims.map(dim)
    if (parsed.some(p => p.value === null)) return false
    const id = newId('r')
    rows.push({ id, qty: r.qty, part: r.part, thickness: parsed[0].value!, width: parsed[1].value!, length: parsed[2].value!, wood: r.wood, notes: '' })
    ref(id, l)
    const unsure = (l.uncertain ?? []).some(w => /\d/.test(w))
    if (unsure) flags[id] = 'check me — the reader was unsure of a number on this line'
    else if (r.flag) flags[id] = r.flag
    else if (parsed.some(p => p.metric)) flags[id] = 'check me — converted from metric'
    return true
  }

  for (const l of lines) {
    if (l === nameLine) continue
    const text = l.text.trim()
    if (!text) continue
    if (isHeading(l)) {
      const h = text.toLowerCase()
      section = /tool/.test(h) ? 'tools' : /material|suppl|hardware/.test(h) ? 'materials' : /cut|lumber/.test(h) ? 'cut' : 'steps'
      inTable = false
      current = null
      continue
    }
    if (isTableHeader(text)) {
      inTable = true
      section = 'cut'
      continue
    }
    if (inTable) {
      const r = matchTableRow(text)
      if (r && addRow(r, l)) continue
      inTable = false
    }
    const row = matchRow(text)
    if (row && addRow(row, l)) continue

    // Tools are picked up from any line outside the steps.
    if (section !== 'steps') {
      const lower = ` ${text.toLowerCase()} `
      const found = Object.keys(toolNames)
        .map(name => ({ name, at: lower.search(new RegExp(String.raw`[^a-z]${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^a-z]`)) }))
        .filter(x => x.at >= 0)
        .sort((a, b) => a.at - b.at || b.name.length - a.name.length)
      for (const f of found) if (!tools.includes(toolNames[f.name])) tools.push(toolNames[f.name])
      if (found.length && section === 'tools') continue
    }

    const s = stepStart(text)
    // A numbered line starts a step anywhere except inside a tools or materials list.
    if (s && section !== 'tools' && section !== 'materials') {
      if (steps.length && s.n !== steps[steps.length - 1].n + 1) {
        notes.push(`Step numbers jump from ${steps[steps.length - 1].n} to ${s.n} — a step may be missing.`)
      }
      current = { id: newId('s'), text: s.text }
      steps.push({ step: current, n: s.n })
      ref(current.id, l)
      if ((l.uncertain ?? []).some(w => /\d/.test(w))) flags[current.id] = 'check me — the reader was unsure of a number on this line'
      section = 'steps'
      continue
    }
    if (section === 'steps' && current) {
      current.text = `${current.text} ${text}`.trim()
      continue
    }
    if (MATERIAL_WORDS.test(text) && section !== 'cut') {
      // "1-1/4" pocket screws (24)" or "24 pocket screws": the amount is the count in brackets or in front.
      const inBrackets = /\s*\((\d+)\)\s*$/.exec(text)
      const inFront = inBrackets ? null : /^(\d+)\s+(?=[A-Za-z])/.exec(text)
      const amount = inBrackets?.[1] ?? inFront?.[1] ?? ''
      const what = inBrackets ? text.slice(0, inBrackets.index) : inFront ? text.slice(inFront[0].length) : text
      materials.push({ text: what.trim(), amount })
      continue
    }
    if (section === 'intro' && l.page === nameLine?.page && (bodySize === undefined || (l.size ?? bodySize) >= bodySize)) description.push(text)
  }

  plan.steps = steps.map(s => s.step)
  plan.cutRows = rows
  plan.materials = materials
  plan.tools = tools
  plan.description = description.join(' ')
  plan.review = review
  plan.unchecked = [...plan.steps.map(s => s.id), ...rows.map(r => r.id)]
  plan.checkNotes = flags
  return { plan, flags, notes }
}
