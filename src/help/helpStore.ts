// Whether the Help window is open, and what it is showing.
import { createStore, useStore } from 'zustand'
import type { Audience } from './types'

export type HelpView = 'topics' | 'shortcuts'
export type HelpState = {
  open: boolean
  audience: Audience
  view: HelpView
  /** The topic being read (kids help starts at the list when this is null). */
  topicId: string | null
  /** What had focus before help opened, so focus can go back there. */
  opener: HTMLElement | null
}

export const help = createStore<HelpState>(() => ({ open: false, audience: 'master', view: 'topics', topicId: null, opener: null }))
export const useHelp = <T,>(select: (s: HelpState) => T) => useStore(help, select)

export function openHelp(opts: { audience: Audience; topicId?: string | null; view?: HelpView }) {
  const s = help.getState()
  const active = typeof document !== 'undefined' ? document.activeElement : null
  help.setState({
    open: true,
    audience: opts.audience,
    view: opts.view ?? 'topics',
    topicId: opts.topicId ?? null,
    // Opening again from inside help keeps the first place to return to.
    opener: s.open ? s.opener : active instanceof HTMLElement && active !== document.body ? active : null
  })
}

export function closeHelp() {
  const { open, opener } = help.getState()
  if (!open) return
  help.setState({ open: false, opener: null })
  if (opener?.isConnected) opener.focus()
}
