let counter = 0

/** A unique id like "b_lq3x9k_1": prefix b = board, j = joint, w = wood, s = plan step, r = cut row, p = plan. */
export function newId(prefix: 'b' | 'j' | 'w' | 's' | 'r' | 'p' | 'k'): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}_${counter}`
}
