import { useEffect, useState } from 'react'

/** Asks for the parent PIN. onSubmit returns false for a wrong PIN, which shows a message and stays open. */
export function PinPrompt({ title, onSubmit, onDone }: { title: string; onSubmit(pin: string): Promise<boolean>; onDone(): void }) {
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(false)
  const [pinSet, setPinSet] = useState<boolean | null>(null)
  useEffect(() => {
    void window.aa.kidsPinIsSet().then(setPinSet)
  }, [])
  const submit = async () => {
    if (await onSubmit(pin)) onDone()
    else {
      setWrong(true)
      setPin('')
    }
  }
  if (pinSet === null) return null
  if (!pinSet) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div role="dialog" aria-label="Parent PIN" className="w-[28rem] rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="mb-3 text-xl font-bold">{title}</h2>
          <p className="text-lg">Set a parent PIN first: tap the ⚙️ gear on the Kids&apos; Workshop home screen.</p>
          <div className="mt-4 flex justify-end"><button onClick={onDone} className="rounded bg-amber-700 px-4 py-2 font-semibold text-white">OK</button></div>
        </div>
      </div>
    )
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        role="dialog"
        aria-label="Parent PIN"
        onSubmit={e => {
          e.preventDefault()
          void submit()
        }}
        className="w-[28rem] rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="mb-3 text-xl font-bold">{title}</h2>
        <label className="flex flex-col gap-1 text-lg">
          Parent PIN
          <input autoFocus aria-label="PIN" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} className="rounded border-2 border-stone-300 px-3 py-2 text-2xl tracking-widest" />
        </label>
        {wrong && <p role="alert" className="mt-2 text-red-700">That PIN isn&apos;t right.</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onDone} className="rounded border border-stone-400 px-4 py-2">Cancel</button>
          <button type="submit" disabled={pin.length !== 4} className="rounded bg-amber-700 px-4 py-2 font-semibold text-white disabled:opacity-40">OK</button>
        </div>
      </form>
    </div>
  )
}
