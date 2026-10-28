// The Kids' Workshop content model: lessons, quizzes, tools, levels and starter projects.

export type Tier = 'beginner' | 'intermediate' | 'advanced' | 'adult'

export type Card = { image: string; text: string[]; tip?: { kind: 'try' | 'safety'; text: string } }

/** A lesson, or a library page (library pages use level 0). */
export type Lesson = { id: string; title: string; level: number; cards: Card[] }

export type Question = { prompt: string; choices: string[]; correct: number; reason: string }

export type Quiz = { id: string; level: number; questions: Question[] }

export type Tool = { id: string; name: string; tier: Tier; page?: string }

export type Level = { id: number; name: string; lessons: string[]; quiz: string }

export type KidProject = {
  id: string
  name: string
  level: number
  stars: 1 | 2 | 3
  minutes: number
  kind: 'useful' | 'outdoors' | 'toy' | 'gift'
  picture: string
  blurb: string
  tools: string[]
  steps: { text: string; tool?: string }[]
}

/** Everything the Kids' Workshop reads, as plain data. */
export type Content = {
  levels: Level[]
  lessons: Record<string, Lesson>
  quizzes: Record<string, Quiz>
  tools: Record<string, Tool>
  library: Lesson[]
  projects: KidProject[]
}
