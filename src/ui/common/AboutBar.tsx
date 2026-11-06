// On the Home screen: the app's version, and a way to open the folder holding the problem log.
import { useState } from 'react'

type Info = { version: string; electron: string; platform: string; logFolder: string }

export function AboutBar() {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<Info | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const show = async () => {
    setOpen(true)
    setNote(null)
    try { setInfo((await window.aa.appInfo?.()) ?? null) } catch { setInfo(null) }
  }
  const openLogs = async () => {
    let ok = false
    try { ok = (await window.aa.openLogFolder?.()) === true } catch { ok = false }
    setNote(ok ? null : `The folder couldn't be opened here. It is at ${info?.logFolder ?? 'the logs folder inside the app’s data folder'}.`)
  }
  return (
    <div className="mt-3 text-sm">
      <button type="button" onClick={() => void show()} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">About</button>
      {open && (
        <div role="dialog" aria-label="About" className="mt-3 max-w-xl rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">A&amp;A Woodworking Studio</h2>
          <p className="mt-1 text-stone-700">{info ? `Version ${info.version}` : 'Version not available'}</p>
          <p className="mt-3 text-stone-600">If something goes wrong, the app writes a short note about it to a log file. It lists what failed and when, never what is in your projects. If you ask for help, send the newest log.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void openLogs()} className="rounded-lg bg-amber-800 px-3 py-1.5 text-white hover:bg-amber-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Open log folder</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-stone-300 px-3 py-1.5 hover:bg-stone-50">Close</button>
          </div>
          {note && <p role="status" className="mt-3 text-stone-700">{note}</p>}
        </div>
      )}
    </div>
  )
}
