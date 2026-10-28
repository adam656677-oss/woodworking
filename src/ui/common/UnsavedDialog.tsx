import { studio, useStudio } from '../store'

/** Asked before New, Open or Recover would replace a project that has unsaved changes. */
export function UnsavedDialog() {
  const open = useStudio(s => s.pendingReplace)
  const name = useStudio(s => s.project.name)
  if (!open) return null
  const answer = (c: 'save' | 'discard' | 'cancel') => void studio.getState().resolvePending(c)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div role="dialog" aria-modal="true" aria-label="Unsaved changes" className="w-96 rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-2 text-lg font-bold">Save changes to “{name}”?</h2>
        <p className="mb-4 text-sm text-stone-600">Your changes will be lost if you don&apos;t save them.</p>
        <div className="flex justify-end gap-2">
          <button className="rounded bg-amber-700 px-3 py-1 text-white" onClick={() => answer('save')} autoFocus>Save</button>
          <button className="rounded border border-stone-400 px-3 py-1" onClick={() => answer('discard')}>Don&apos;t Save</button>
          <button className="rounded border border-stone-400 px-3 py-1" onClick={() => answer('cancel')}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
