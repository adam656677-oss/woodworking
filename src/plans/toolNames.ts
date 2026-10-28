// Names a plan might use for each tool in the app's tool list.
import { TOOLS } from '../kids/content'

const ALIASES: Record<string, string> = {
  'cordless drill': 'drill', drill: 'drill', 'drill/driver': 'drill', 'impact driver': 'drill',
  'jig saw': 'jigsaw', jigsaw: 'jigsaw', 'scroll saw': 'scroll-saw',
  'random orbit sander': 'sander', 'orbital sander': 'sander', sander: 'sander',
  'miter saw': 'miter-saw', 'mitre saw': 'miter-saw', 'chop saw': 'miter-saw',
  'table saw': 'table-saw', router: 'router', lathe: 'lathe', 'band saw': 'band-saw', planer: 'planer',
  'brad nailer': 'brad-nailer', 'nail gun': 'brad-nailer', 'block plane': 'block-plane',
  clamp: 'clamps', clamps: 'clamps', hammer: 'hammer', square: 'square', 'speed square': 'square',
  'tape measure': 'tape-measure', tape: 'tape-measure', pencil: 'pencil', screwdriver: 'screwdriver',
  'hand saw': 'hand-saw', handsaw: 'hand-saw', 'miter box': 'miter-box'
}

/** Lower-case name → tool id, for every tool the app knows. */
export const TOOL_NAMES: Record<string, string> = {
  ...Object.fromEntries(Object.values(TOOLS).map(t => [t.name.toLowerCase(), t.id])),
  ...ALIASES
}
