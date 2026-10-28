// Loads the Kids' Workshop content (bundled JSON) and checks it for mistakes.
import type { Project } from '../../model/types'
import { validate } from '../../model/validate'
import { ART } from '../art'
import type { Content, KidProject, Lesson, Level, Quiz, Tool } from '../types'
import { buildDesign, DESIGNS } from './designs'
import levelsJson from './levels.json'
import toolsJson from './tools.json'

const byId = <T extends { id: string }>(mods: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.values(mods).map(m => [m.id, m]))

const lessonFiles = import.meta.glob<Lesson>('./lessons/*.json', { eager: true, import: 'default' })
const quizFiles = import.meta.glob<Quiz>('./quizzes/*.json', { eager: true, import: 'default' })
const libraryFiles = import.meta.glob<Lesson>('./library/*.json', { eager: true, import: 'default' })
const projectFiles = import.meta.glob<KidProject>('./projects/*.json', { eager: true, import: 'default' })

export const LEVELS: Level[] = levelsJson as Level[]
export const LESSONS: Record<string, Lesson> = byId(lessonFiles)
export const QUIZZES: Record<string, Quiz> = byId(quizFiles)
export const TOOLS: Record<string, Tool> = toolsJson as Record<string, Tool>
export const LIBRARY: Lesson[] = Object.values(libraryFiles).sort((a, b) => a.title.localeCompare(b.title))
/** Starter projects in the order they are taught; any added later follow by level and name. */
const ORDER = ['pencil-holder', 'tic-tac-toe', 'birdhouse', 'picture-frame', 'toolbox']
const rank = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length)
export const PROJECTS: KidProject[] = Object.values(projectFiles).sort(
  (a, b) => rank(a.id) - rank(b.id) || a.level - b.level || a.name.localeCompare(b.name)
)

export const CONTENT: Content = { levels: LEVELS, lessons: LESSONS, quizzes: QUIZZES, tools: TOOLS, library: LIBRARY, projects: PROJECTS }

export function findProject(id: string): KidProject | undefined {
  return PROJECTS.find(p => p.id === id)
}

const designCache = new Map<string, Project>()
/** The starter project's design as a full project (the same model the Master Shop uses). */
export function designFor(projectId: string): Project {
  let d = designCache.get(projectId)
  if (!d) {
    d = buildDesign(projectId, findProject(projectId)?.name ?? projectId)
    designCache.set(projectId, d)
  }
  return d
}

/** Every problem in a set of content, in plain words. An empty list means it is all good. */
export function checkContentOf(c: Content): string[] {
  const problems: string[] = []
  const pic = (where: string, name: string) => {
    if (!ART[name]) problems.push(`${where}: picture "${name}" does not exist`)
  }
  for (const lv of c.levels) {
    if (!c.quizzes[lv.quiz]) problems.push(`Level ${lv.id}: quiz "${lv.quiz}" does not exist`)
    for (const id of lv.lessons) if (!c.lessons[id]) problems.push(`Level ${lv.id}: lesson "${id}" does not exist`)
  }
  for (const l of [...Object.values(c.lessons), ...c.library]) {
    if (l.cards.length === 0) problems.push(`${l.id}: has no cards`)
    l.cards.forEach((card, i) => pic(`${l.id} card ${i + 1}`, card.image))
  }
  for (const q of Object.values(c.quizzes)) {
    if (q.questions.length < 5 || q.questions.length > 8) problems.push(`${q.id}: needs 5 to 8 questions`)
    q.questions.forEach((x, i) => {
      if (!Number.isInteger(x.correct) || x.correct < 0 || x.correct >= x.choices.length) problems.push(`${q.id} question ${i + 1}: the right answer is not one of the choices`)
    })
  }
  for (const t of Object.values(c.tools)) {
    if (t.page && !c.library.some(l => l.id === t.page)) problems.push(`tool ${t.id}: page "${t.page}" does not exist`)
  }
  for (const p of c.projects) {
    pic(p.id, p.picture)
    for (const t of p.tools) if (!c.tools[t]) problems.push(`${p.id}: tool "${t}" does not exist`)
    p.steps.forEach((s, i) => {
      if (s.tool && !c.tools[s.tool]) problems.push(`${p.id} step ${i + 1}: tool "${s.tool}" does not exist`)
    })
    if (!c.levels.some(l => l.id === p.level)) problems.push(`${p.id}: level ${p.level} does not exist`)
  }
  return problems
}

/** The bundled content, plus every starter design checked against the design rules. */
export function checkContent(): string[] {
  const problems = checkContentOf(CONTENT)
  for (const p of PROJECTS) {
    if (!DESIGNS[p.id]) {
      problems.push(`${p.id}: has no design`)
      continue
    }
    for (const w of validate(designFor(p.id))) problems.push(`${p.id} design: ${w.message}`)
  }
  return problems
}
