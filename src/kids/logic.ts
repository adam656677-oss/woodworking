// The Kids' Workshop rules: quiz scoring and shuffling, what is open, "Adult does this", and badges.
import { LEVELS, PROJECTS, TOOLS } from './content'
import type { Progress } from './progress'
import type { KidProject, Quiz, Tier } from './types'

export { newProgress, type Progress } from './progress'

export const TIER_RANK: Record<Tier, number> = { beginner: 0, intermediate: 1, advanced: 2, adult: 3 }

/** Questions needed to pass: 80%, rounded up to a whole question. */
export function passMark(total: number): number {
  return Math.ceil(0.8 * total - 1e-9)
}

export function scoreQuiz(answers: number[], quiz: Quiz): { correct: number; total: number; passed: boolean } {
  const total = quiz.questions.length
  const correct = quiz.questions.filter((q, i) => answers[i] === q.correct).length
  return { correct, total, passed: correct >= passMark(total) }
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** A new order for the questions and for each question's answers; the right answer moves with its text. */
export function shuffleQuiz(quiz: Quiz, rand: () => number): Quiz {
  return {
    ...quiz,
    questions: shuffled(quiz.questions, rand).map(q => {
      const order = shuffled(q.choices.map((_, i) => i), rand)
      return { ...q, choices: order.map(i => q.choices[i]), correct: order.indexOf(q.correct) }
    })
  }
}

const quizOf = (level: number) => LEVELS.find(l => l.id === level)?.quiz

export function levelOpen(level: number, p: Progress): boolean {
  if (level <= 1) return true
  const prev = quizOf(level - 1)
  return prev !== undefined && prev in p.passedQuizzes
}

export function projectUnlocked(proj: KidProject, p: Progress): boolean {
  const q = quizOf(proj.level)
  return q !== undefined && q in p.passedQuizzes
}

/** A step is for a grown-up when its tool is above the child's tier (grown-up-only tools always are). */
export function adultDoes(toolId: string | undefined, tier: Tier): boolean {
  const tool = toolId ? TOOLS[toolId] : undefined
  if (!tool) return false
  return tool.tier === 'adult' || TIER_RANK[tool.tier] > TIER_RANK[tier]
}

export type Badge = { kind: 'level' | 'project'; id: string; name: string; date: string }

/** Badges come only from passed level quizzes and projects the parent confirmed as built. */
export function badges(p: Progress): Badge[] {
  const out: Badge[] = []
  for (const lv of LEVELS) {
    const date = p.passedQuizzes[lv.quiz]
    if (date) out.push({ kind: 'level', id: `level-${lv.id}`, name: lv.name, date })
  }
  for (const proj of PROJECTS) {
    const built = p.builtProjects[proj.id]
    if (built) out.push({ kind: 'project', id: `project-${proj.id}`, name: proj.name, date: built.date })
  }
  return out
}
