// How the 3D view is drawn (CAD or realistic), the lighting, and the image export. Display only: none of it is
// saved in the project file.
import { createStore, useStore } from 'zustand'
import type { LightPreset } from './materials'
import { studio } from '../ui/store'

export type CaptureOpts = { scale: number; transparent: boolean }
export type Capture = (o: CaptureOpts) => { dataUrl: string; width: number; height: number } | null
export type RenderedView = { key: 'iso' | 'front' | 'exploded'; label: string; dataUrl: string }

type State = {
  mode: 'cad' | 'real'
  light: LightPreset
  /** Shadows and ambient occlusion in the realistic view (turn off on a slow computer). */
  effects: boolean
  exportOpen: boolean
  /** Front / 3D / exploded pictures made for the plan packet (this session). */
  views: RenderedView[]
  /** Set by the 3D view while it's on screen. */
  capture: Capture | null
  set(p: Partial<Omit<State, 'set'>>): void
}

export const render = createStore<State>(set => ({
  mode: 'cad', light: 'studio', effects: true, exportOpen: false, views: [], capture: null,
  set: p => set(p)
}))
export const useRender = <T,>(sel: (s: State) => T) => useStore(render, sel)

// Pictures belong to the project they were made of: a new or opened project starts without them.
let lastKey = studio.getState().projectKey
studio.subscribe(s => { if (s.projectKey !== lastKey) { lastKey = s.projectKey; if (render.getState().views.length) render.setState({ views: [] }) } })

/** A file name for the picture. */
export const imageName = (project: string, what = '') => `${project || 'Project'}${what ? ` - ${what}` : ''}`
