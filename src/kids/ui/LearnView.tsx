import { Art } from '../art'
import { LIBRARY } from '../content'
import { kids } from '../kidsStore'
import { KidsPageFrame } from './kit'

/** The library: tools, woods and "tree to board". Always open. */
export function LearnView() {
  const groups: [string, (id: string) => boolean][] = [
    ['Wood', id => id.startsWith('wood-') || id === 'tree-to-board'],
    ['Tools', id => id.startsWith('tool-')]
  ]
  return (
    <KidsPageFrame title="Learn">
      {groups.map(([title, match]) => (
        <section key={title} className="mx-auto mb-8 max-w-5xl">
          <h2 className="mb-3 text-3xl font-bold">{title}</h2>
          <ul className="grid grid-cols-4 gap-4">
            {LIBRARY.filter(l => match(l.id)).map(l => (
              <li key={l.id}>
                <button onClick={() => kids.getState().go({ name: 'lesson', id: l.id, card: 0, back: 'learn' })} className="flex w-full flex-col items-center gap-2 rounded-2xl border-4 border-sky-200 bg-white p-4 text-xl font-semibold hover:bg-sky-50">
                  <Art name={l.cards[0].image} className="block h-16 w-16" />
                  {l.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </KidsPageFrame>
  )
}
