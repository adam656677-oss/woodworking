import { Component, type ErrorInfo, type ReactNode } from 'react'
import { studio } from '../store'
import { reportError } from './reportError'

/** Last line of defence: if a screen crashes, say so plainly and offer to save, instead of a blank window. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; message: string }> {
  state = { failed: false, message: '' }
  static getDerivedStateFromError(e: unknown) {
    return { failed: true, message: e instanceof Error ? e.message : String(e) }
  }
  componentDidCatch(e: unknown, info: ErrorInfo) {
    reportError('react.boundary', e, info.componentStack ? `Component stack:${info.componentStack}` : undefined)
  }
  render() {
    if (!this.state.failed) return this.props.children
    const s = studio.getState()
    return (
      <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 bg-stone-100 p-8 text-center text-stone-800">
        <h1 className="text-xl font-bold">Something went wrong on this screen.</h1>
        <p className="max-w-md text-sm text-stone-600">Your project is still here. Save it now, then go back to the start.</p>
        <p className="max-w-md text-xs text-stone-500">{this.state.message}</p>
        <p className="max-w-md text-sm text-stone-600">Details about what happened were saved to a log file. If this keeps happening, open the log folder and send the newest file to whoever is helping you.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="rounded bg-amber-700 px-3 py-1 text-white" onClick={() => void s.saveAs()}>Save a copy…</button>
          <button
            className="rounded border border-stone-400 px-3 py-1"
            onClick={() => {
              studio.getState().goto('home')
              this.setState({ failed: false, message: '' })
            }}
          >
            Back to the start
          </button>
          <button className="rounded border border-stone-400 px-3 py-1" onClick={() => void window.aa?.openLogFolder?.()}>Open log folder</button>
        </div>
      </div>
    )
  }
}
