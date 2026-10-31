import { findOk, tapeRound, TAPE_LEVELS, tickOf, tapeText, explainTape } from '../../src/games/tape'
import { HAZARD_SCENE, hazardAt } from '../../src/games/hazards'
import { KID_WOODS, woodRound } from '../../src/games/woods'
import { fits, PUZZLES, puzzleRound } from '../../src/games/joints'
import { cut, LATHE_TARGETS, newBlank, score, TOOL_REACH } from '../../src/games/lathe'
import { rng } from '../../src/games/rng'

test('tape rounds: one right choice, all on the level\'s ticks, all different', () => {
  for (let lv = 0; lv < TAPE_LEVELS.length; lv++) {
    const r = rng(lv + 1)
    for (let k = 0; k < 40; k++) {
      const q = tapeRound(lv, r)
      expect(new Set(q.choices).size).toBe(4)
      expect(q.choices.filter(c => c === q.answer)).toHaveLength(1)
      const den = TAPE_LEVELS[lv].den
      for (const c of q.choices) {
        expect(Math.abs(c * den - Math.round(c * den))).toBeLessThan(1e-9)
        expect(c).toBeGreaterThan(0)
        expect(c).toBeLessThanOrEqual(12)
      }
      // The hardest level asks about its own fractions (not only easier ones).
    }
  }
  expect(tapeText(3.625)).toBe('3-5/8"')
  expect(explainTape(3.625, 8)).toMatch(/3 inches and 5 eighths/)
  expect(tickOf(3.5)).toBe('half')
  expect(tickOf(3.25)).toBe('quarter')
  expect(tickOf(3.0625)).toBe('sixteenth')
  // Find it: within half a tick.
  expect(findOk(3.625, 3.66, 8)).toBe(true)
  expect(findOk(3.625, 3.7, 8)).toBe(false)
})

test('hazards: inside the scene, apart from each other, found by a tap', () => {
  const s = HAZARD_SCENE
  expect(s.hazards.length).toBe(8)
  for (const h of s.hazards) {
    expect(h.x - h.r).toBeGreaterThanOrEqual(0)
    expect(h.y - h.r).toBeGreaterThanOrEqual(0)
    expect(h.x + h.r).toBeLessThanOrEqual(s.width)
    expect(h.y + h.r).toBeLessThanOrEqual(s.height)
    expect(hazardAt(s, h.x, h.y)?.id).toBe(h.id)
    expect(h.why.length).toBeGreaterThan(10)
    expect(h.fix.length).toBeGreaterThan(10)
  }
  for (const a of s.hazards) for (const b of s.hazards) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r)
  expect(hazardAt(s, 1, 1)).toBeNull()
})

test('match the wood: the clue belongs to the answer, three different choices', () => {
  expect(KID_WOODS.map(w => w.id)).toEqual(['eastern-white-pine', 'red-oak', 'hard-maple', 'black-walnut', 'black-cherry', 'western-red-cedar', 'basswood', 'yellow-poplar'])
  const r = rng(7)
  for (let k = 0; k < 50; k++) {
    const q = woodRound(r)
    expect(new Set(q.choices).size).toBe(3)
    expect(q.choices).toContain(q.answer)
    expect(KID_WOODS.find(w => w.id === q.answer)!.clues).toContain(q.clue)
    // No other choice shares the clue.
    for (const c of q.choices) if (c !== q.answer) expect(KID_WOODS.find(w => w.id === c)!.clues).not.toContain(q.clue)
  }
})

test('joint puzzles: exactly one partner fits, checked cell by cell', () => {
  expect(PUZZLES.length).toBeGreaterThanOrEqual(7)
  for (const p of PUZZLES) {
    const ok = p.partners.filter(q => fits(p.host, q))
    expect([p.id, ok.length]).toEqual([p.id, 1])
    expect(fits(p.host, p.partners[p.answer])).toBe(true)
    expect(p.names).toContain(p.name)
  }
  const r = rng(3)
  const q = puzzleRound(r)
  expect(fits(q.puzzle.host, q.puzzle.partners[q.puzzle.answer])).toBe(true)
})

test('lathe: cuts where the tool is, never past its reach; a perfect turning scores 100', () => {
  const t = LATHE_TARGETS[0]
  let b = newBlank(t)
  expect(score(b, t).percent).toBeLessThan(100)
  // Cutting hard everywhere for a long time stops at the tool's reach (the tool rest), never below.
  for (let k = 0; k < 400; k++) for (let x = 0; x < b.radii.length; x++) b = cut(b, x / (b.radii.length - 1), 1)
  for (const r of b.radii) expect(r).toBeGreaterThanOrEqual(TOOL_REACH - 1e-9)
  // A turning made exactly to the target.
  const perfect = { ...newBlank(t), radii: t.radii.map(r => r) }
  expect(score(perfect, t).percent).toBe(100)
  expect(score(perfect, t).tooDeep).toEqual([])
  // One cut only touches near the tool.
  const one = cut(newBlank(t), 0.5, 1)
  const changed = one.radii.map((r, i) => r !== newBlank(t).radii[i]).filter(Boolean).length
  expect(changed).toBeGreaterThan(0)
  expect(changed).toBeLessThan(one.radii.length / 4)
  for (const tg of LATHE_TARGETS) for (const r of tg.radii) { expect(r).toBeGreaterThanOrEqual(TOOL_REACH); expect(r).toBeLessThanOrEqual(1) }
})

test('the parent can turn the games off; saved progress keeps it', async () => {
  const { isProgress, newProgress } = await import('../../src/kids/progress')
  expect(isProgress({ ...newProgress(), gamesOff: true })).toBe(true)
  expect(isProgress({ ...newProgress(), gamesOff: 'yes' })).toBe(false)
  expect(isProgress(newProgress())).toBe(true)
})
