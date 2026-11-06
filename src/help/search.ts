import type { HelpTopic } from './types'

const words = (text: string) => text.toLowerCase().replace(/\*\*/g, ' ').split(/[^\p{L}\p{N}]+/u).filter(Boolean)

/** Does any word in `haystack` start with `term`? ("templ" finds "template".) */
const hits = (haystack: string[], term: string) => haystack.some(w => w.startsWith(term))

/**
 * Topics matching every word typed, best first (ties keep their order in the list).
 * A word in the title counts most, then keywords and summary, then the steps.
 */
export function searchTopics(topics: HelpTopic[], query: string): HelpTopic[] {
  const terms = words(query)
  if (!terms.length) return topics
  const scored: { topic: HelpTopic; score: number; index: number }[] = []
  topics.forEach((topic, index) => {
    const title = words(topic.title)
    const near = words(`${topic.keywords.join(' ')} ${topic.summary} ${topic.group}`)
    const body = words(`${topic.steps.join(' ')} ${topic.tip ?? ''}`)
    let score = 0
    for (const term of terms) {
      const s = hits(title, term) ? 6 : hits(near, term) ? 3 : hits(body, term) ? 1 : 0
      if (!s) return
      score += s
    }
    scored.push({ topic, score, index })
  })
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map(x => x.topic)
}
