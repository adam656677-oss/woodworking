// "Describe a project": a sentence to a starting design. Offline, a word matcher picks the closest template and reads
// sizes from the text; online, the helper's answer (a template with settings, or a list of parts) is checked.
import { parseInches } from '../model/units'
import { findTemplate, TEMPLATES, type ParamValue, type TemplateDef } from '../templates'
import { checkPlan, type DraftPlan } from './plan'

// Most specific words first.
const WORDS: [RegExp, string][] = [
  [/wall shelf|floating shelf|hanging shelf/i, 'wallShelf'], [/step ?stool|step stool/i, 'stepStool'], [/cutting board|chopping board|butcher block/i, 'cuttingBoard'],
  [/work ?bench|shop table/i, 'workbench'], [/base cabinet|vanity|kitchen cabinet|cabinet/i, 'cabinet'], [/bird ?house|nest box/i, 'birdhouse'],
  [/book ?(case|shelf)|shelves|shelving|shelf/i, 'bookshelf'], [/side table|end table|night ?stand|bedside|table/i, 'table'],
  [/box|crate|chest|bin/i, 'box'], [/stool/i, 'stepStool']
]

const SIZE_WORDS: [RegExp, RegExp][] = [
  [/wide|width|across/i, /width|^W$/i], [/deep|depth/i, /depth/i], [/tall|high|height/i, /height|wall height/i], [/long|length/i, /length|width/i]
]

const AMOUNT = String.raw`(\d+(?:\.\d+)?(?:[- ]\d+\/\d+)?|\d+\/\d+)\s*(?:"|''|in\b|inch(?:es)?|ft\b|feet|foot|')?`

/** The closest template and its settings, read from the words (no internet needed). */
export function matchTemplate(text: string): { def: TemplateDef; params: Record<string, ParamValue>; read: string[] } | null {
  const id = WORDS.find(([re, id]) => re.test(text) && findTemplate(id))?.[1]
  const def = id ? findTemplate(id) : undefined
  if (!def) return null
  const params: Record<string, ParamValue> = {}
  const read: string[] = []
  // "30 inches wide", "36 tall", "2 feet deep", "width 30"
  const re = new RegExp(`${AMOUNT}\\s*(wide|width|across|deep|depth|tall|high|height|long|length)|(wide|width|deep|depth|tall|height|long|length)\\s*(?:of|is|=|:)?\\s*${AMOUNT}`, 'gi')
  for (const m of text.matchAll(re)) {
    const amountText = m[1] ?? m[4]
    const word = m[2] ?? m[3]
    const feet = /ft|feet|foot|'/i.test(m[0].replace(amountText, '').split(word)[0] ?? '') && !/''/.test(m[0])
    const r = parseInches(amountText)
    if (!r.ok) continue
    const value = feet ? r.value * 12 : r.value
    const target = SIZE_WORDS.find(([w]) => w.test(word))?.[1]
    const p = target && def.params.find(x => x.kind === 'inches' && (target.test(x.label) || target.test(x.key)) && !(x.key in params))
    if (p) { params[p.key] = value; read.push(`${p.label}: ${value}"`) }
  }
  // "3 shelves", "8 strips", "4 boards"
  for (const m of text.matchAll(/(\d+)\s+(shelves|shelf|strips|boards|drawers)/gi)) {
    const p = def.params.find(x => x.kind === 'count' && x.label.toLowerCase().includes(m[2].toLowerCase().slice(0, 4)))
    if (p) { params[p.key] = Number(m[1]); read.push(`${p.label}: ${m[1]}`) }
  }
  if (/\bno lid|without (a )?lid/i.test(text)) params.lid = false
  else if (/\blid\b/i.test(text) && def.params.some(p => p.key === 'lid')) params.lid = true
  return { def, params, read }
}

/** The online helper's answer: a template with settings (checked by the template itself) or a plan of parts. */
export function checkDescribeAnswer(raw: unknown): { template: string; params: Record<string, ParamValue> } | { plan: DraftPlan } | { error: string } {
  const r = raw as any
  if (r && typeof r.template === 'string') {
    const def = findTemplate(r.template)
    if (!def) return { error: `The helper picked a template the app doesn't have (${String(r.template).slice(0, 30)}).` }
    const params: Record<string, ParamValue> = {}
    for (const p of def.params) {
      const v = r.params?.[p.key]
      if (p.kind === 'inches' || p.kind === 'count') { if (typeof v === 'number' && Number.isFinite(v)) params[p.key] = v }
      else if (p.kind === 'bool') { if (typeof v === 'boolean') params[p.key] = v }
      else if (typeof v === 'string' && (p.kind === 'wood' || p.options?.includes(v))) params[p.key] = v
    }
    return { template: def.id, params }
  }
  const plan = checkPlan(r)
  return 'error' in plan ? plan : { plan }
}

/** What the online helper is told about the templates it can choose. */
export const templateMenu = () => TEMPLATES.map(t => `${t.id} (${t.name}): ${t.params.map(p => `${p.key} = ${p.label}${p.kind === 'inches' ? ' in inches' : p.kind === 'count' ? ' (a count)' : p.kind === 'bool' ? ' (true/false)' : p.kind === 'choice' ? ` (one of ${p.options!.join(', ')})` : ' (a wood id)'}`).join('; ')}`).join('\n')
