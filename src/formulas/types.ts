// Named sizes and layout rules stored in a project.

export type SizeDef = { name: string; expr: string }
export type Axis3 = 'x' | 'y' | 'z'
export const AXES3: Axis3[] = ['x', 'y', 'z']

export type Rule =
  /** The parts sit evenly between the inner faces of `from` and `to` along `axis`. */
  | { id: string; kind: 'spacing'; axis: Axis3; from: string; to: string; parts: string[] }
  /** `part`'s centre equals `on`'s centre on each axis. */
  | { id: string; kind: 'center'; axes: Axis3[]; part: string; on: string }
  /** `part` sits `gap` from `to`'s face on `side` (max = beyond `to`'s far face, min = before its near face). */
  | { id: string; kind: 'gap'; axis: Axis3; part: string; to: string; side: 'min' | 'max'; gap: number; gapExpr?: string }
  /** A run of `first` plus copies, as many as `expr` says, spaced evenly between `from` and `to`. */
  | { id: string; kind: 'count'; expr: string; first: string; copies: string[]; axis: Axis3; from: string; to: string }

export type RuleKind = Rule['kind']
export const RULE_KINDS: RuleKind[] = ['spacing', 'center', 'gap', 'count']
