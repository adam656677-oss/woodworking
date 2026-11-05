// Which help F1 (and the Help button) opens for the screen someone is on.
import type { Screen } from '../ui/store'
import type { Audience } from './types'

export type HelpContext = { screen: Screen; kidsMode: boolean; kidsPage?: string }
export type HelpTarget = { audience: Audience; topicId?: string }

const MASTER_BY_SCREEN: Partial<Record<Screen, string>> = {
  plans: 'plans', draw: 'shaped', finish: 'finishing', library: 'library-tools', joints: 'library-tools', tools: 'library-tools'
}

const KIDS_BY_PAGE: Record<string, string> = {
  path: 'lessons', lesson: 'lessons', quiz: 'quizzes', projects: 'projects', project: 'projects', learn: 'lessons',
  badges: 'badges', parent: 'grown-ups', sheet: 'print-sheet', certificate: 'badges', plans: 'my-plans', calc: 'math', games: 'games', game: 'games'
}

export function helpFor({ screen, kidsMode, kidsPage }: HelpContext): HelpTarget {
  if (screen === 'kids') return { audience: 'kids', topicId: kidsPage ? KIDS_BY_PAGE[kidsPage] : undefined }
  // The Simple Designer and Draw It! are the kids' tools, even though they are separate screens.
  if (kidsMode) return { audience: 'kids', topicId: screen === 'draw' ? 'draw-it' : screen === 'master' ? 'designer' : undefined }
  return { audience: 'master', topicId: MASTER_BY_SCREEN[screen] }
}
