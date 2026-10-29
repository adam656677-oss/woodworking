import { useState } from 'react'
import type { Board, Project } from '../../model/types'
import { formatInches } from '../../model/units'
import { InchInput } from '../../ui/designer/InchInput'
import { studio } from '../../ui/store'
import { addEdgeProfile, edgeNote, edgeProblemFor, KID_PROFILES, KID_SIZES, PROFILE_NAMES, removeEdgeProfile, SIZES, STRAIGHT_SIDES } from '../edges'
import { PROFILE_KINDS, type EdgeSide, type ProfileKind } from '../types'

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

export function EdgesSection({ board, kids }: { board: Board; kids: boolean }) {
  const [profile, setProfile] = useState<ProfileKind>('roundover')
  const [size, setSize] = useState(1 / 4)
  const [face, setFace] = useState<'top' | 'bottom'>('top')
  const shaped = !!board.outline
  const [sides, setSides] = useState<EdgeSide[]>(shaped ? ['outline'] : [])
  const [error, setError] = useState<string | null>(null)
  const kinds = kids ? KID_PROFILES : PROFILE_KINDS
  const sizes = kids ? KID_SIZES : SIZES
  const notes = (board.edges ?? []).map(e => edgeNote(e) + (edgeProblemFor(board, board.edges!, e) ? ' (doesn\u2019t fit — not shown)' : ''))
  const add = (both = false, chosen?: EdgeSide[]) => {
    let p: Project | { error: string } = studio.getState().project
    for (const f of both ? (['top', 'bottom'] as const) : [face]) {
      if ('error' in p) break
      p = addEdgeProfile(p, board.id, { profile, size, face: f, sides: shaped ? ['outline'] : chosen ?? sides })
    }
    if ('error' in p) return setError(p.error)
    setError(null)
    const next = p
    studio.getState().apply(() => next)
  }
  const sideToggle = (s: EdgeSide) => setSides(cur => (cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]))
  return (
    <details open={!!board.edges?.length || kids || undefined} className="rounded border border-stone-200 p-2">
      <summary className="cursor-pointer text-sm font-semibold">{kids ? 'Round the edges' : 'Edges'}</summary>
      <div className="mt-2 flex flex-col gap-2 text-sm">
        {kids && <p className="text-xs text-stone-600">Round the edges (sand, or router with a grown-up).</p>}
        {notes.length > 0 && (
          <ul className="flex flex-col gap-1">
            {board.edges!.map((e, i) => (
              <li key={e.id} className="flex items-center justify-between rounded bg-stone-100 px-2 py-0.5 text-xs">
                {notes[i]}
                <button aria-label={`Remove ${notes[i]}`} onClick={() => studio.getState().apply(p => removeEdgeProfile(p, board.id, e.id))} className="px-1 font-bold text-stone-500 hover:text-red-700">✕</button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Profile">
          {kinds.map(k => (
            <button key={k} role="radio" aria-checked={profile === k} onClick={() => setProfile(k)} className={`rounded px-2 py-0.5 text-xs ${profile === k ? 'bg-amber-700 text-white' : 'border border-stone-300'}`}>{cap(PROFILE_NAMES[k])}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-1" role="radiogroup" aria-label="Size">
          {sizes.map(s => (
            <button key={s} role="radio" aria-checked={Math.abs(size - s) < 1e-9} onClick={() => setSize(s)} className={`rounded px-2 py-0.5 text-xs ${Math.abs(size - s) < 1e-9 ? 'bg-amber-700 text-white' : 'border border-stone-300'}`}>{formatInches(s)}</button>
          ))}
          {!kids && <div className="w-20"><InchInput label="Other size" value={size} onChange={setSize} /></div>}
        </div>
        <div className="flex gap-3 text-xs">
          {(['top', 'bottom'] as const).map(f => (
            <label key={f} className="flex items-center gap-1"><input type="radio" name={`face-${board.id}`} checked={face === f} onChange={() => setFace(f)} />{cap(f)} face</label>
          ))}
        </div>
        {shaped ? (
          <p className="text-xs text-stone-600">Follows the whole {face} outline, cutouts too.</p>
        ) : (
          <div className="flex flex-wrap gap-2 text-xs">
            {STRAIGHT_SIDES.map(s => (
              <label key={s} className="flex items-center gap-1"><input type="checkbox" aria-label={`${cap(s)} edge`} checked={sides.includes(s)} onChange={() => sideToggle(s)} />{cap(s)}</label>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {!shaped && <button onClick={() => { setFace('top'); setSides([...STRAIGHT_SIDES]) }} className="rounded border border-stone-300 px-2 py-0.5 text-xs">All top edges</button>}
          <button onClick={() => add()} className="rounded bg-amber-700 px-3 py-0.5 text-xs font-semibold text-white">Add {PROFILE_NAMES[profile]}</button>
          {!kids && <button onClick={() => { if (!shaped) setSides([...STRAIGHT_SIDES]); add(true, [...STRAIGHT_SIDES]) }} className="rounded border border-stone-300 px-2 py-0.5 text-xs" title="Top and bottom faces">All edges</button>}
        </div>
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>
    </details>
  )
}
