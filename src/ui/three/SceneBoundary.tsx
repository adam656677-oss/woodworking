import { Component, type ReactNode } from 'react'

/** If the 3D view can't start (no WebGL, old graphics driver), keep the rest of the designer working. */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-stone-600">
          <p className="font-semibold">The 3D view couldn&apos;t start on this computer.</p>
          <p className="text-sm">You can still edit parts, joints and the cut list. Updating the graphics driver usually fixes this.</p>
          <button className="mt-2 rounded border px-3 py-1 text-sm" onClick={() => this.setState({ failed: false })}>Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}
