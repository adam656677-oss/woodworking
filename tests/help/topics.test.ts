import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { KIDS_TOPICS } from '../../src/help/kidsTopics'
import { SHORTCUTS } from '../../src/help/shortcuts'
import { boldLabels, MASTER_TOPICS } from '../../src/help/topics'
import type { HelpTopic } from '../../src/help/types'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return p.endsWith(join('src', 'help')) ? [] : sourceFiles(p)
    return /\.(ts|tsx)$/.test(p) ? [p] : []
  })
}
/** All the words the app shows, as written in the source (JSX entities turned into what people see). */
const appText = sourceFiles(join(process.cwd(), 'src')).map(f => readFileSync(f, 'utf8')).join('\n')
  .replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&ldquo;|&rdquo;/g, '"').replace(/[\u2018\u2019]/g, "'")
const norm = (s: string) => s.replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ')
const shownInApp = (label: string) => {
  const esc = norm(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![A-Za-z])${esc}(?![A-Za-z])`).test(appText)
}

const both: [string, HelpTopic[]][] = [['master', MASTER_TOPICS], ['kids', KIDS_TOPICS]]

describe.each(both)('%s help topics', (_name, topics) => {
  it('have unique ids and the parts every topic needs', () => {
    expect(new Set(topics.map(t => t.id)).size).toBe(topics.length)
    for (const t of topics) {
      expect(t.title.length, t.id).toBeGreaterThan(5)
      expect(t.summary.length, t.id).toBeGreaterThan(10)
      expect(t.steps.length, t.id).toBeGreaterThanOrEqual(2)
      expect(t.steps.length, `${t.id} should be short`).toBeLessThanOrEqual(9)
      expect(t.keywords.length, t.id).toBeGreaterThan(0)
      for (const s of t.steps) expect(s.trim().length, t.id).toBeGreaterThan(8)
    }
  })

  it('declare every button or label they mention, and nothing they do not mention', () => {
    for (const t of topics) {
      const mentioned = boldLabels(t)
      const declared = [...t.labels].sort()
      expect([...new Set(mentioned)].sort(), `${t.id}: **bold** names in the text must equal "labels"`).toEqual(declared)
    }
  })

  it('only name buttons and labels that still exist in the app', () => {
    const missing = topics.flatMap(t => t.labels.filter(l => !shownInApp(l)).map(l => `${t.id}: "${l}"`))
    expect(missing, 'A help topic names a label that is no longer in the source: update src/help').toEqual([])
  })

  it('only point at shortcuts that exist', () => {
    const ids = new Set(SHORTCUTS.map(s => s.id))
    for (const t of topics) for (const id of t.shortcuts ?? []) expect(ids.has(id), `${t.id} -> ${id}`).toBe(true)
  })
})

describe('master help covers what the app does', () => {
  const ids = MASTER_TOPICS.map(t => t.id)
  it.each([
    'template', 'boards', 'move', 'views', 'joints', 'formulas', 'cut-list', 'build-plan', 'shaped', 'full-size',
    'export', 'finishing', 'plans', 'shop-mode', 'backup', 'sharing', 'smart', 'files', 'autosave'
  ])('has a topic for %s', id => expect(ids).toContain(id))
})

describe('kids help follows the kids\' rules', () => {
  const text = KIDS_TOPICS.flatMap(t => [t.title, t.summary, ...t.steps, t.tip ?? '']).join(' ').toLowerCase()
  it.each(['streak', 'points', 'coins', 'currency', 'score', 'leaderboard', 'you missed', "don't forget", 'hurry', 'lose'])('never says "%s"', word => {
    expect(new RegExp(`\\b${word}\\b`).test(text)).toBe(false)
  })
  it('uses short sentences and plain words', () => {
    for (const t of KIDS_TOPICS) for (const s of [t.summary, ...t.steps]) {
      expect(s.split(/\s+/).length, `${t.id}: "${s}" is too long for a young reader`).toBeLessThanOrEqual(28)
    }
  })
  it('covers lessons, games, the simple designer and printing a project sheet', () => {
    const ids = KIDS_TOPICS.map(t => t.id)
    for (const id of ['lessons', 'games', 'designer', 'print-sheet']) expect(ids).toContain(id)
  })
})
