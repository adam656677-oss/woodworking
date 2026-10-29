import type { Project } from '../model/types'
import type { FormulaError } from './recalc'

/** Layout rules (filled in by the next step). */
export function applyRules(p: Project, _sizes: Map<string, number>): { project: Project; errors: FormulaError[] } {
  return { project: p, errors: [] }
}
