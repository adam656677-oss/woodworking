// On the Home screen: back up everything, or restore from a backup.
import { useEffect, useState } from 'react'
import { studio } from '../../ui/store'

const clean = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
const AFTER = 'aa:restore-result'
type Done = { text: string; folders: string[] }

export function BackupBar() {
  const [msg, setMsg] = useState<{ text: string; bad?: boolean; folders?: string[] } | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [pin, setPin] = useState('')
  const [needPin, setNeedPin] = useState(false)
  const [busy, setBusy] = useState(false)
  // A restore reloads the app; its result is shown when it comes back.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(AFTER)
      if (raw) { sessionStorage.removeItem(AFTER); const d = JSON.parse(raw) as Done; setMsg({ text: d.text, folders: d.folders }) }
    } catch { /* nothing to show */ }
  }, [])
  const backup = async () => {
    setBusy(true)
    try {
      const r = await window.aa.backup()
      if (r) setMsg({ text: `Backed up ${r.files} files to ${r.path}.${r.skipped.length ? ` ${r.skipped.length} file${r.skipped.length === 1 ? " couldn't" : "s couldn't"} be read and ${r.skipped.length === 1 ? 'was' : 'were'} left out: ${r.skipped.slice(0, 5).join(', ')}${r.skipped.length > 5 ? ' …' : ''}.` : ''} Keep a copy somewhere else too — a USB stick or a cloud folder.` })
    } catch (e) { setMsg({ text: `The backup didn't finish: ${clean(e)}`, bad: true }) } finally { setBusy(false) }
  }
  const startRestore = async () => {
    if (studio.getState().dirty) return setMsg({ text: 'Save the project open in the Master Shop first (or close it), then restore.', bad: true })
    setNeedPin(await window.aa.kidsPinIsSet())
    setPin('')
    setConfirm(true)
  }
  const restore = async () => {
    setBusy(true)
    try {
      const r = await window.aa.restore(pin)
      if (!r) return
      setConfirm(false)
      const folders = [r.keptDocs, r.keptUser].filter((x): x is string => !!x)
      const done: Done = { text: `Restored ${r.files} files from the backup.${folders.length ? ' Files it replaced are kept here:' : ''}`, folders }
      try { sessionStorage.setItem(AFTER, JSON.stringify(done)) } catch { /* shown before the reload instead */ }
      setMsg(done)
      // Reload straight away so nothing still in memory saves over what was just put back.
      window.location.reload()
    } catch (e) { setMsg({ text: clean(e), bad: true }) } finally { setBusy(false) }
  }
  return (
    <section aria-label="Backup" className="flex flex-col items-center gap-2 text-sm text-stone-700">
      <div className="flex gap-3">
        <button disabled={busy} onClick={() => void backup()} className="rounded-lg border border-stone-400 bg-white px-3 py-1 hover:bg-stone-100 disabled:opacity-50">{busy && !confirm ? 'Working…' : '💾 Back up everything…'}</button>
        <button disabled={busy} onClick={() => void startRestore()} className="rounded-lg border border-stone-400 bg-white px-3 py-1 hover:bg-stone-100 disabled:opacity-50">Restore from a backup…</button>
      </div>
      <p className="text-xs text-stone-500">Backs up the projects and plans in Documents\A&amp;A Woodworking, the shop journal and inventory, and the kids’ progress.</p>
      {confirm && (
        <form role="dialog" aria-label="Restore from a backup" onSubmit={e => { e.preventDefault(); void restore() }} onKeyDown={e => e.key === 'Escape' && setConfirm(false)} className="flex flex-col items-center gap-2 rounded-xl bg-white p-3 shadow">
          <p className="max-w-md text-center">Restoring puts back the projects, plans, journal, inventory and kids’ progress (and the parent PIN) from the backup. Anything it replaces is kept aside first. Files made since the backup stay as they are.</p>
          {needPin && <input autoFocus aria-label="Parent PIN" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value)} placeholder="Parent PIN" className="w-28 rounded border px-2 py-1 text-center" />}
          <div className="flex gap-2">
            <button type="submit" autoFocus={!needPin} disabled={busy} className="rounded bg-amber-700 px-3 py-1 font-semibold text-white disabled:opacity-50">{busy ? 'Restoring…' : 'Choose the backup file…'}</button>
            <button type="button" onClick={() => setConfirm(false)} className="rounded border px-3 py-1">Cancel</button>
          </div>
        </form>
      )}
      {msg && (
        <div role={msg.bad ? 'alert' : 'status'} className={`max-w-xl text-center ${msg.bad ? 'text-red-700' : 'text-green-800'}`}>
          {msg.text}
          {msg.folders?.map(f => <div key={f} className="mt-1 flex items-center justify-center gap-2"><code className="break-all text-xs">{f}</code><button className="underline" onClick={() => void window.aa.showFolder?.(f)}>Open</button></div>)}
        </div>
      )}
    </section>
  )
}
