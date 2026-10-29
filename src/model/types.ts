import type { Outline, Sketch } from '../sketch/types'
// The project model: plain data shared by every part of the app. Sizes are inches.

export type Vec3 = { x: number; y: number; z: number }

export type WoodKind = 'lumber' | 'hardwood' | 'sheet'

export type Wood = {
  id: string
  name: string
  kind: WoodKind
  species: string
  thickness: number
  width: number
  length: number
  /** Lumber only: lengths sold (inches). `length` is the longest. */
  availableLengths?: number[]
  pricePerBoardFoot?: number
  pricePerSheet?: number
  builtIn: boolean
}

/** A drilled hole. u runs along the width, v along the length, from the board's origin corner. */
export type Hole = { diameter: number; u: number; v: number }

/**
 * An angled end. Degrees from square (0 = square cut), -60..60.
 * miter tilts across the face: positive puts the short point on the +x edge.
 * bevel tilts through the thickness: positive puts the short point on the +z face.
 */
export type EndCut = { miter: number; bevel: number }

/**
 * A board. Local axes: x = width, y = length, z = thickness; position is the origin corner.
 * `length` is the long-point length. `start` is the y = 0 end; `left` is the x = 0 edge.
 */
export type Board = {
  id: string
  name: string
  woodId: string
  thickness: number
  width: number
  length: number
  position: Vec3
  rotation: Vec3
  grain: 'length' | 'width'
  holes: Hole[]
  endCuts: { start: EndCut; end: EndCut }
  edgeBevels: { left: number; right: number }
  /** A shaped part: cut to this outline from a drawing (width × length are its bounding rectangle). */
  outline?: Outline
}

export type JointType = 'butt' | 'dado' | 'rabbet' | 'pocketScrew' | 'miter'

export type ButtParams = { fastener: 'glue' | 'screws' | 'nails'; count: number }
/**
 * A dado or rabbet in the host. along 'width' (default): runs across the board, `offset` from the start end.
 * along 'length': runs down the board, `offset` from the left edge.
 */
export type GrooveParams = { width: number; depth: number; offset: number; face: 'top' | 'bottom'; along?: 'width' | 'length' }
export type PocketParams = { count: number; spacing: number; screwLength: number }
export type MiterParams = { angle: number; fastener: 'glue' | 'nails' | 'splines' }

/** What adding a joint changed on one board, so removing it can undo exactly that (in any order). */
export type JointRestore = {
  boardId: string
  side: 'start' | 'end' | 'left' | 'right'
  /** Inches added at that end/edge. */
  extend: number
  /** For miters: which angle on that end was set, and its value before. */
  field?: 'miter' | 'bevel'
  previous?: number
}

export type Joint = {
  id: string
  type: JointType
  hostBoardId: string
  partnerBoardId: string
  params: ButtParams | GrooveParams | PocketParams | MiterParams
  restore?: JointRestore[]
}

export type TemplateState = { templateId: string; params: Record<string, number | boolean | string> }

export type Project = {
  /** 2 adds drawings; version 1 files are upgraded when opened. */
  formatVersion: 1 | 2
  name: string
  units: 'in'
  boards: Board[]
  joints: Joint[]
  woods: Wood[]
  template?: TemplateState
  /** Drawings (sketches) — shaped parts point into these. */
  sketches?: Sketch[]
}

export const SQUARE: EndCut = { miter: 0, bevel: 0 }
