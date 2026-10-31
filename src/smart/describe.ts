// "Describe a project": a sentence to a starting design. Offline, a word matcher picks the closest template and reads
// sizes from the text; online, the helper's answer (a template with settings, or a list of parts) is checked.
import { parseInches } from '../model/units'
import { findTemplate, TEMPLATES, type ParamValue, type TemplateDef } from '../templates'
import { checkPlan, type DraftPlan } from './plan'
import type { Wood } from '../model/types'

// Most specific words first; whole words only (so "combine" isn't a bin).
const WORDS: [RegExp, string][] = [
  [/\b(wall|floating|hanging) shel(f|ves)\b/i, 'wallShelf'], [/\bstep ?stools?\b/i, 'stepStool'], [/\b(cutting|chopping) boards?\b|\bbutcher ?block\b/i, 'cuttingBoard'],
  [/\bwork ?bench(es)?\b|\bshop table\b/i, 'workbench'], [/\b(base |kitchen )?cabinets?\b|\bvanity\b/i, 'cabinet'], [/\bbird ?house\b|\bnest ?box\b/i, 'birdhouse'],
  [/\bbook ?(case|shelf|shelves)\b|\bshel(f|ves|ving)\b/i, 'bookshelf'], [/\b(side|end|coffee|accent) table\b|\bnight ?stand\b|\bbedside\b|\btables?\b/i, 'table'],
  [/\b(box|boxes|crate|chest|bin)\b/i, 'box'], [/\bstools?\b/i, 'stepStool']
]

// Which setting each size word fills ("strip width" isn't how wide a cutting board is).
const SIZE_WORDS: [RegExp, RegExp][] = [
  [/wide|width|across/i, /^(top |floor )?width|^W$/i], [/deep|depth/i, /depth/i], [/tall|high|height/i, /^height|^wall height/i]
]

const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 }
const NUM = String.raw`(?:\d+(?:\.\d+)?(?:[- ]\d+\/\d+)?|\d+\/\d+|${Object.keys(WORD_NUM).join('|')})`
const FT = String.raw`(?:\s*(?:ft\b|feet\b|foot\b|'(?!')))`
const IN = String.raw`(?:\s*(?:"|''|in\b|inch(?:es)?\b))`
/** A length: "30", "30 inches", "2-1/2 ft", "4 feet 6 inches", 4' 6". */
const LEN = String.raw`${NUM}${FT}(?:\s*(?:and\s+)?${NUM}${IN}?)?|${NUM}${IN}?`

const numberOf = (s: string): number | null => {
  const w = WORD_NUM[s.toLowerCase()]
  if (w) return w
  const r = parseInches(s.replace(/(\d) (\d+\/)/, '$1-$2'))
  return r.ok ? r.value : null
}
/** Inches from a length as written. */
function inchesOf(text: string): number | null {
  const ft = new RegExp(String.raw`^(${NUM})${FT}(?:\s*(?:and\s+)?(${NUM})${IN}?)?$`, 'i').exec(text.trim())
  if (ft) { const f = numberOf(ft[1]), i = ft[2] ? numberOf(ft[2]) : 0; return f === null || i === null ? null : f * 12 + i }
  const m = new RegExp(String.raw`^(${NUM})${IN}?$`, 'i').exec(text.trim())
  return m ? numberOf(m[1]) : null
}

/** The closest template and its settings, read from the words (no internet needed). */
export function matchTemplate(text: string): { def: TemplateDef; params: Record<string, ParamValue>; read: string[] } | null {
  const id = WORDS.find(([re, id]) => re.test(text) && findTemplate(id))?.[1]
  const def = id ? findTemplate(id) : undefined
  if (!def) return null
  const params: Record<string, ParamValue> = {}
  const read: string[] = []
  const inches = def.params.filter(x => x.kind === 'inches')
  const setTo = (p: { key: string; label: string } | undefined, value: number) => { if (p && !(p.key in params)) { params[p.key] = value; read.push(`${p.label}: ${value}"`) } }
  const byWord = (word: string) => {
    if (/long|length/i.test(word)) return inches.find(x => /length/i.test(x.label)) ?? (params.W === undefined ? inches.find(x => SIZE_WORDS[0][1].test(x.label) || x.key === 'W') : undefined)
    const target = SIZE_WORDS.find(([w]) => w.test(word))?.[1]
    return target && inches.find(x => target.test(x.label) || target.test(x.key))
  }
  // "30 x 48 x 12": width × height × depth.
  const box = new RegExp(String.raw`(${LEN})\s*(?:x|×|by)\s*(${LEN})(?:\s*(?:x|×|by)\s*(${LEN}))?`, 'i').exec(text)
  // "30 inches wide", "36 tall", "2 feet deep", "width 30"
  const re = new RegExp(String.raw`(${LEN})\s*(wide|width|across|deep|depth|tall|high|height|long|length)\b|\b(wide|width|deep|depth|tall|height|long|length)\s*(?:of|is|=|:)?\s*(${LEN})`, 'gi')
  for (const m of text.matchAll(re)) {
    const v = inchesOf(m[1] ?? m[4])
    if (v !== null) setTo(byWord(m[2] ?? m[3]), v)
  }
  if (box) {
    const [w, h, d] = [box[1], box[2], box[3]].map(s => (s ? inchesOf(s) : null))
    if (w !== null) setTo(byWord('wide'), w)
    if (h !== null) setTo(byWord('tall'), h)
    if (d !== null) setTo(byWord('deep'), d)
  }
  // A cutting board's width is its strips: as many as make that width.
  const strip = def.params.find(x => x.key === 'strip'), n = def.params.find(x => x.key === 'n' && x.kind === 'count')
  const wide = new RegExp(String.raw`(${LEN})\s*(?:wide|across)\b`, 'i').exec(text)
  if (strip && n && wide && !('n' in params)) {
    const w = inchesOf(wide[1])
    if (w) { const k = Math.max(n.min ?? 1, Math.min(n.max ?? 40, Math.round(w / (strip.default as number)))); params.n = k; read.push(`${n.label}: ${k}`) }
  }
  // "3 shelves", "four strips", "4 boards"
  for (const m of text.matchAll(new RegExp(String.raw`\b(\d+|${Object.keys(WORD_NUM).join('|')})\s+(shelves|shelf|strips|boards|drawers)\b`, 'gi'))) {
    const p = def.params.find(x => x.kind === 'count' && x.label.toLowerCase().includes(m[2].toLowerCase().slice(0, 4)))
    const k = numberOf(m[1])
    if (p && k !== null && !(p.key in params)) { params[p.key] = k; read.push(`${p.label}: ${k}`) }
  }
  if (def.params.some(p => p.key === 'lid')) {
    if (/\bno lid\b|\bwithout (a )?lid\b/i.test(text)) params.lid = false
    else if (/\blid\b/i.test(text)) params.lid = true
  }
  return { def, params, read }
}

/** The online helper's answer: a template with settings (checked by the template itself) or a plan of parts. */
export function checkDescribeAnswer(raw: unknown, woods: Wood[] = []): { template: string; params: Record<string, ParamValue> } | { plan: DraftPlan } | { error: string } {
  const r = raw as any
  if (r && typeof r.template === 'string') {
    const def = findTemplate(r.template)
    if (!def) return { error: `The helper picked a template the app doesn't have (${String(r.template).slice(0, 30)}).` }
    const params: Record<string, ParamValue> = {}
    for (const p of def.params) {
      const v = r.params?.[p.key]
      if (p.kind === 'inches' || p.kind === 'count') { if (typeof v === 'number' && Number.isFinite(v)) params[p.key] = v }
      else if (p.kind === 'bool') { if (typeof v === 'boolean') params[p.key] = v }
      else if (typeof v === 'string' && (p.kind === 'wood' ? woods.some(w => w.id === v) : p.options?.includes(v))) params[p.key] = v
    }
    return { template: def.id, params }
  }
  const plan = checkPlan(r)
  return 'error' in plan ? plan : { plan }
}

/** What the online helper is told about the templates it can choose. */
export const templateMenu = (woods: Wood[] = []) => (woods.length ? `Wood ids: ${woods.map(w => `${w.id} (${w.name})`).join(', ')}\n` : '') + TEMPLATES.map(t => `${t.id} (${t.name}): ${t.params.map(p => `${p.key} = ${p.label}${p.kind === 'inches' ? ' in inches' : p.kind === 'count' ? ' (a count)' : p.kind === 'bool' ? ' (true/false)' : p.kind === 'choice' ? ` (one of ${p.options!.join(', ')})` : ' (a wood id)'}`).join('; ')}`).join('\n')
