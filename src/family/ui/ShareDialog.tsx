// Share a project as a package (the design and its journal), or open one someone shared.
import { useState } from 'react'
import { newId } from '../../model/ids'
import { studio, useStudio } from '../../ui/store'
import { tools } from '../../tools/store'
import { makePackage, openPackage } from '../package'

const clean = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export function ShareDialog({ onClose }: { onClose(): void }) {
  const project = useStudio(s => s.project)
  const file = useStudio(s => s.filePath)
  const [from, setFrom] = useState('')
  const [note, setNote] = useState('')
  const [withJournal, setWithJournal] = useState(true)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const share = async () => {
    try {
      if (!tools.getState().loaded) await tools.getState().load()
      const pkg = makePackage(project, file, tools.getState().journal, { from, note, withJournal })
      const path = await window.aa.savePackage(project.name, pkg)
      if (path) setMsg({ text: `Saved ${path}. Send that one file — it opens with "Open a shared project…".` })
    } catch (e) { setMsg({ text: clean(e), bad: true }) }
  }
  return (
    <div role="dialog" aria-label="Share this project" className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div className="flex w-[30rem] flex-col gap-3 rounded-lg bg-white p-4 shadow-xl">
        <h2 className="text-lg font-bold">Share “{project.name}”</h2>
        <p className="text-sm text-stone-600">Makes one file with the design{withJournal ? ', and its shop journal (notes, time, costs and photos)' : ''}. Whoever opens it gets their own copy.</p>
        <label className="flex flex-col text-sm">From<input aria-label="From" value={from} onChange={e => setFrom(e.target.value)} placeholder="Your name" className="rounded border px-2 py-1" /></label>
        <label className="flex flex-col text-sm">Note<textarea aria-label="Note" value={note} onChange={e => setNote(e.target.value)} placeholder="Anything they should know" className="h-16 rounded border px-2 py-1" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={withJournal} onChange={e => setWithJournal(e.target.checked)} />Include the shop journal and photos</label>
        <div className="flex gap-2">
          <button onClick={() => void share()} className="rounded bg-amber-700 px-3 py-1 text-sm font-semibold text-white">Save the package…</button>
          <button onClick={onClose} className="ml-auto rounded border px-3 py-1 text-sm">Close</button>
        </div>
        {msg && <p role={msg.bad ? 'alert' : 'status'} className={`text-sm ${msg.bad ? 'text-red-700' : 'text-green-800'}`}>{msg.text}</p>}
      </div>
    </div>
  )
}

/** Opens a shared package: the design opens as a new, unsaved project and its journal entries join yours. */
export async function openShared(): Promise<string | null> {
  try {
    const pkg = await window.aa.openPackage()
    if (!pkg) return null
    const r = openPackage(pkg, () => newId('r'))
    if (!tools.getState().loaded) await tools.getState().load()
    for (const e of r.journal) { const { id: _i, ...rest } = e; tools.getState().addEntry(rest) }
    studio.getState().openDesignText(r.text)
    return pkg.note ? `${pkg.from ? `From ${pkg.from}: ` : ''}${pkg.note}` : pkg.from ? `Shared by ${pkg.from}.` : 'Opened.'
  } catch (e) {
    studio.getState().setError(clean(e))
    return null
  }
}
