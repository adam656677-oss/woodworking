// Finishing schedules: the steps from bare wood to the last coat, with templates, checks and total time.
import { newId } from '../model/ids'
import type { FinishSchedule, FinishStep, Project } from '../model/types'
import { canGoOver } from './compat'
import { finishById, hoursText } from './finishes'

type StepIn = Omit<FinishStep, 'id'>
const step = (s: StepIn): FinishStep => ({ ...s, id: newId('f') })
const sand = (grit: number, notes?: string): StepIn => ({ kind: 'prep', title: `Sand to ${grit} grit`, coats: 1, dryHours: 0, ...(notes ? { notes } : {}) })
const coat = (kind: FinishStep['kind'], finishId: string, coats: number, extra: Partial<StepIn> = {}): StepIn => {
  const f = finishById(finishId)!
  return { kind, title: `${f.methods[0] === 'spray' ? 'Spray' : f.methods[0] === 'brush' ? 'Brush on' : 'Wipe on'} ${f.name.toLowerCase()}`, finishId, method: f.methods[0], coats, dryHours: f.recoat, ...extra }
}

export const TEMPLATES: { id: string; name: string; about: string; steps: StepIn[] }[] = [
  { id: 'oil-wax', name: 'Oil & wax', about: 'A warm, natural, hand-rubbed look. Easy and easy to renew; light protection.', steps: [
    sand(180), coat('topcoat', 'danish', 3, { notes: 'Wipe off all the excess after 15–30 minutes.' }), coat('rubout', 'paste-wax', 1, { title: 'Wax and buff', notes: 'Apply with #0000 steel wool; buff when hazy.' })] },
  { id: 'shellac', name: 'Shellac', about: 'A quick, glowing traditional finish. Dries in minutes; not for tabletops that see water.', steps: [
    sand(220), coat('seal', 'shellac', 1, { title: 'Seal with 1-lb cut shellac' }), sand(320, 'Lightly, just to knock off dust nibs.'), coat('topcoat', 'shellac', 3, { title: 'Pad or brush on 2-lb cut shellac' }), { kind: 'rubout', title: 'Rub out with #0000 steel wool and wax', coats: 1, dryHours: 0 }] },
  { id: 'wipe-poly', name: 'Wipe-on poly', about: 'Tough and forgiving: thin wiped coats, few runs or brush marks.', steps: [
    sand(180), coat('topcoat', 'wipe-poly', 4, { sheen: 'Satin', notes: 'Sand lightly with 320 between coats.' })] },
  { id: 'waterborne', name: 'Waterborne', about: 'Clear, low-smell and fast. Shellac first keeps it from looking cold.', steps: [
    sand(180), { kind: 'prep', title: 'Raise the grain', coats: 1, dryHours: 1, notes: 'Wipe with a damp rag, let dry, sand lightly with 220.' },
    coat('seal', 'shellac', 1, { title: 'Seal with 1-lb cut shellac (warms the colour)' }), coat('topcoat', 'water-poly', 3, { method: 'brush', sheen: 'Satin', notes: 'Synthetic brush; sand with 320 between coats.' })] },
  { id: 'spray-lacquer', name: 'Spray lacquer', about: 'The production furniture finish: fast, smooth, rubs out beautifully. Needs a spray setup.', steps: [
    sand(180), coat('colour', 'oil-stain', 1, { notes: 'Optional. Let it dry overnight before spraying.' }), coat('seal', 'sanding-sealer', 1), sand(320, 'Sand the sealer smooth.'),
    coat('topcoat', 'nitro', 3, { sheen: 'Satin' }), { kind: 'rubout', title: 'Rub out', coats: 1, dryHours: 0, notes: 'After a week: 600 grit, then rubbing compound or #0000 steel wool for satin.' }] },
  { id: 'painted', name: 'Painted', about: 'A painted piece: primer that blocks knots and tannin, then two coats of enamel.', steps: [
    sand(150), coat('seal', 'shellac', 1, { title: 'Prime with shellac-based primer', notes: 'Spot-prime knots first.' }), sand(220),
    coat('topcoat', 'latex-paint', 2, { title: 'Brush or spray acrylic enamel', sheen: 'Semi-gloss' })] }
]

/** A schedule from a template, with fresh step ids. */
export function fromTemplate(id: string): FinishSchedule {
  const t = TEMPLATES.find(x => x.id === id) ?? TEMPLATES[0]
  return { name: t.name, steps: t.steps.map(step) }
}

export const setSchedule = (p: Project, s: FinishSchedule | null): Project => {
  const { finish: _f, ...rest } = p
  return s ? { ...p, finish: s } : rest
}
export const newStep = (s: StepIn) => step(s)

/** Problems with a schedule's order: each finish against the last finish under it. */
export function checkSchedule(s: FinishSchedule): { stepId: string; level: 'warn' | 'error'; text: string }[] {
  const out: { stepId: string; level: 'warn' | 'error'; text: string }[] = []
  let under: string | null = null
  for (const st of s.steps) {
    if (!st.finishId) continue
    if (under) {
      const a = canGoOver(st.finishId, under)
      const u = finishById(under)!.name, t = finishById(st.finishId)!.name
      if (a.answer === 'no') out.push({ stepId: st.id, level: 'error', text: `${t} over ${u.toLowerCase()}: ${a.why}` })
      if (a.answer === 'barrier') out.push({ stepId: st.id, level: 'warn', text: `${t} over ${u.toLowerCase()}: put ${a.barrier} between. ${a.why}` })
    }
    under = st.finishId
  }
  for (const st of s.steps) if (!(st.coats >= 1) || !(st.dryHours >= 0)) out.push({ stepId: st.id, level: 'error', text: `${st.title}: give the coats and drying time` })
  return out
}

/** Working-and-waiting time: each coat's drying time (the last coat of the schedule counted to dry, not to cure), and the cure after. */
export function scheduleTime(s: FinishSchedule): { hours: number; cureDays: number; text: string } {
  let hours = 0
  for (const st of s.steps) hours += st.coats * st.dryHours
  const last = [...s.steps].reverse().find(st => st.finishId && finishById(st.finishId)?.role === 'topcoat')
  const cureDays = last ? finishById(last.finishId!)!.cure : 0
  return { hours, cureDays, text: `About ${hoursText(hours)} of coats and drying${cureDays ? `, then ${cureDays} days to cure fully before hard use` : ''}` }
}

/** One line per step for Shop Mode and the plan packet. */
export function stepText(st: FinishStep): string {
  const f = st.finishId ? finishById(st.finishId) : undefined
  const bits = [
    st.product ? `Product: ${st.product}.` : '',
    st.coats > 1 ? `${st.coats} coats` + (st.dryHours ? `, ${hoursText(st.dryHours)} between coats.` : '.') : st.dryHours ? `Let it dry ${hoursText(st.dryHours)}.` : '',
    st.sheen ? `Sheen: ${st.sheen}.` : '',
    st.notes ?? '',
    f?.rags ? 'Oily rags can catch fire by themselves: lay them flat outside to dry or keep them in a sealed can of water.' : '',
    f?.methods.length === 1 && f.methods[0] === 'spray' ? 'Spray with ventilation and a respirator.' : ''
  ]
  return bits.filter(Boolean).join(' ')
}
