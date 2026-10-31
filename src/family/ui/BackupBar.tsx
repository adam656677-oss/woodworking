// On the Home screen: back up everything, or restore from a backup.
import { useState } from 'react'

const clean = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export function BackupBar() {
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [pin, setPin] = useState('')
  const [needPin, setNeedPin] = useState(false)
  const backup = async () => {
    try {
      const r = await window.aa.backup()
      if (r) setMsg({ text: `Backed up ${r.files} files to ${r.path}. Keep a copy somewhere else too — a USB stick or cloud folder.` })
    } catch (e) { setMsg({ text: `The backup didn't finish: ${clean(e)}`, bad: true }) }
  }
  const startRestore = async () => {
    setNeedPin(await window.aa.kidsPinIsSet())
    setPin('')
    setConfirm(true)
  }
  const restore = async () => {
    if (needPin && !(await window.aa.kidsCheckPin(pin))) return setMsg({ text: 'That PIN is not right.', bad: true })
    setConfirm(false)
    try {
      const r = await window.aa.restore()
      if (!r) return
      const kept = r.keptUser || r.keptDocs ? ' Files it replaced were kept in a "_before-restore" folder.' : ''
      setMsg({ text: `Restored ${r.files} files.${kept} The app will reload now.` })
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) { setMsg({ text: clean(e), bad: true }) }
  }
  return (
    <section aria-label="Backup" className="flex flex-col items-center gap-2 text-sm text-stone-700">
      <div className="flex gap-3">
        <button onClick={() => void backup()} className="rounded-lg border border-stone-400 bg-white px-3 py-1 hover:bg-stone-100">💾 Back up everything…</button>
        <button onClick={() => void startRestore()} className="rounded-lg border border-stone-400 bg-white px-3 py-1 hover:bg-stone-100">Restore from a backup…</button>
      </div>
      {confirm && (
        <div role="dialog" aria-label="Restore from a backup" className="flex flex-col items-center gap-2 rounded-xl bg-white p-3 shadow">
          <p className="max-w-md text-center">Restoring puts back the projects, plans, journal, inventory and kids' progress from the backup. Anything it replaces is kept aside first.</p>
          {needPin && <input aria-label="Parent PIN" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value)} placeholder="Parent PIN" className="w-28 rounded border px-2 py-1 text-center" />}
          <div className="flex gap-2">
            <button onClick={() => void restore()} className="rounded bg-amber-700 px-3 py-1 font-semibold text-white">Choose the backup file…</button>
            <button onClick={() => setConfirm(false)} className="rounded border px-3 py-1">Cancel</button>
          </div>
        </div>
      )}
      {msg && <p role={msg.bad ? 'alert' : 'status'} className={`max-w-xl text-center ${msg.bad ? 'text-red-700' : 'text-green-800'}`}>{msg.text}</p>}
    </section>
  )
}
