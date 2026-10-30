// The kids' finishing schedules: simple, safe finishes with drying times. Sprays are a grown-up's job.
import type { KidProject } from '../kids/types'

export type KidFinishStep = { text: string; tool?: string }
export type KidFinish = { name: string; steps: KidFinishStep[] }

/** Projects that touch food get food-safe oil. */
const FOOD = new Set(['cutting-board', 'spoon', 'serving-board'])

/** How to finish a kids' project (none for the finish sampler — finishing is the project). */
export function kidFinish(p: KidProject): KidFinish | null {
  if (p.id === 'finish-sampler') return null
  if (FOOD.has(p.id) || /cutting board|spoon|serving/i.test(p.name)) return { name: 'Food-safe oil', steps: [
    { text: 'Sand smooth with 220 sandpaper and wipe off the dust.', tool: 'sandpaper' },
    { text: 'Wipe on food-safe mineral oil. After 15 minutes, wipe off the extra.', tool: 'finish-rag' },
    { text: 'Let it soak in overnight, then add another coat. Re-oil whenever it looks dry.', tool: 'finish-rag' }
  ] }
  if (p.kind === 'outdoors') return { name: 'Outdoor paint (outside only)', steps: [
    { text: 'Leave the inside bare — birds and bugs don\'t like finish.' },
    { text: 'Brush water-based outdoor paint on the outside. Let it dry 4 hours.', tool: 'paintbrush' },
    { text: 'Brush on a second coat and let it dry overnight before it goes outside.', tool: 'paintbrush' }
  ] }
  return { name: 'Wipe-on water-based finish', steps: [
    { text: 'Sand smooth with 220 sandpaper and wipe off all the dust.', tool: 'sandpaper' },
    { text: 'Wearing gloves, wipe on a thin coat of water-based finish along the grain. Let it dry 2 hours.', tool: 'finish-rag' },
    { text: 'Rub lightly with very fine sandpaper, wipe off the dust, and wipe on a second coat. Let it dry 2 hours.', tool: 'finish-rag' },
    { text: 'Want it shiny fast? A grown-up can spray clear finish outside instead.', tool: 'spray-finish' }
  ] }
}
