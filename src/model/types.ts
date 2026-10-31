import type { Outline, Sketch } from '../sketch/types'
import type { EdgeProfile, Taper, Turning } from '../shaping/types'
import type { Rule, SizeDef } from '../formulas/types'
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
  /** Lumber: price of one board by its length in inches ("96": 7.48). */
  pricePerPiece?: Record<string, number>
  builtIn: boolean
}

/** A drilled hole. u runs along the width, v along the length, from the board's origin corner. */
export type Hole = {
  diameter: number; u: number; v: number
  /** A stopped hole this deep, drilled from `face` (top when not given); through when absent. */
  depth?: number
  face?: 'top' | 'bottom'
}

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
  /** A square-to-round turned leg. */
  turning?: Turning
  taper?: Taper
  /** Router edge profiles. */
  edges?: EdgeProfile[]
  /** Formulas for this board's sizes and positions, by field path (width, length, x, y, z, turning.top, holes.0.u, …). */
  formulas?: Record<string, string>
  /** The innermost group (assembly) this part is in. */
  groupId?: string
  /** Shared by the corresponding parts of linked copies. */
  link?: string
  /** Edge banding on these edges (sheet goods). */
  banding?: Banding
}

/** Edge banding: which edges (left/right = along the length, start/end = the ends) and which banding. */
export type Banding = { edges: ('left' | 'right' | 'start' | 'end')[]; bandId: string }

/** Cutting allowances for one material. */
export type StockSettings = { kerf: number; edgeTrim: number; endTrim: number; allowance: number }
/** Layout and buying settings kept with the project. */
export type CutSettings = {
  byWood?: Record<string, Partial<StockSettings>>
  /** Extra hardwood bought for waste, 0..1 (20% when not set). */
  hardwoodWaste?: number
  /** Sales tax, percent. */
  tax?: number
  /** Place parts on the shop's offcuts and boards first. */
  useStock?: boolean
  /** The random-width hardwood boards to plan with. */
  hardwoodBoard?: { width: number; length: number }
}

export type FinishStepKind = 'prep' | 'colour' | 'seal' | 'topcoat' | 'rubout' | 'other'
export type FinishStep = {
  id: string
  kind: FinishStepKind
  /** What to do, in a few words ("Sand to 180", "Wipe on boiled linseed oil"). */
  title: string
  /** A finish from the finish data, when the step puts one on. */
  finishId?: string
  /** A named product (generic or a brand), when the user wants one written down. */
  product?: string
  method?: 'wipe' | 'brush' | 'spray'
  coats: number
  /** Hours to wait after each coat. */
  dryHours: number
  sheen?: string
  notes?: string
}
export type FinishSchedule = { name: string; steps: FinishStep[] }

/** A dimension or note kept on the model (world inches). */
export type Annotation =
  | { id: string; kind: 'dimension'; a: Vec3; b: Vec3; label?: string }
  | { id: string; kind: 'note'; at: Vec3; text: string }

/** A picture placed in the 3D view to design over (a photo or scan), sized in inches. */
export type Reference = {
  id: string
  name: string
  /** front = upright facing you (X across, Z up), side = upright facing right (Y across, Z up), top = flat (X, Y). */
  plane: 'front' | 'side' | 'top'
  dataUrl: string
  width: number
  height: number
  /** The picture's low corner. */
  position: Vec3
  opacity: number
  locked?: boolean
  hidden?: boolean
}

/** An outside 3D model placed in the design as a reference (an appliance, hardware, an existing piece). */
export type RefModel = {
  id: string
  name: string
  /** The file type it came from (stl, obj, 3mf, glb, step). */
  format: string
  /** Its triangles in inches, low corner at its origin, packed (see exchange/models). */
  data: string
  position: Vec3
  /** Degrees about X, Y, Z (as parts turn). */
  rotation: Vec3
  scale: number
  opacity: number
  locked?: boolean
  hidden?: boolean
  /** Left out of the interference and clearance checks. */
  noChecks?: boolean
}

/** Shop Mode ticks and minutes, by step key. */
export type ShopProgressData = { done: string[]; minutes: Record<string, number> }

/** A group of parts (an assembly such as a drawer or a door); groups nest through parentId. */
export type Group = { id: string; name: string; parentId?: string; link?: string; motion?: Motion; oneSheet?: boolean }

/** How a door swings (about a vertical hinge line) or a drawer slides. */
export type Motion =
  | { kind: 'swing'; origin: Vec3; maxDeg: number; dir: 1 | -1 }
  | { kind: 'slide'; dir: Vec3; travel: number }

/** One line of the hardware list: an item (built-in or the project's own) and where it goes. */
export type HardwareUse = { id: string; itemId: string; qty: number; groupId?: string; boardId?: string; note?: string }
export type HardwareKind = 'hinge' | 'slide' | 'pull' | 'screw' | 'pin' | 'glass' | 'other'
/** A hardware item; `price` is per piece (per square foot for glass). */
export type HardwareItem = { id: string; name: string; kind: HardwareKind; price: number }

export type JointType = 'butt' | 'dado' | 'rabbet' | 'pocketScrew' | 'miter' | 'joinery'

export type ButtParams = { fastener: 'glue' | 'screws' | 'nails'; count: number }
/**
 * A dado or rabbet in the host. along 'width' (default): runs across the board, `offset` from the start end.
 * along 'length': runs down the board, `offset` from the left edge.
 */
export type GrooveParams = {
  width: number; depth: number; offset: number; face: 'top' | 'bottom' | 'left' | 'right'; along?: 'width' | 'length'
  /** A cut that stands on its own (a door's glass rabbet): the partner is the part it's on the same frame as, not one sitting in it. */
  standalone?: boolean
}
/**
 * A groove in a board's edge (face 'left' = the x = 0 edge, 'right' = the x = width edge, such as a door stile's
 * panel groove): it runs the full length; `offset` and `width` are across the thickness, `depth` goes into the edge.
 */
export const isEdgeGroove = (p: GrooveParams) => p.face === 'left' || p.face === 'right'
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
  /** A part moved (a cross lap sinks one part into the other): undone by moving it back. */
  move?: Vec3
}

/** The joinery styles (cut joints) beyond the basic ones. */
export type JoineryStyle =
  | 'halfLap' | 'dowel' | 'biscuit' | 'looseTenon' | 'boxJoint' | 'dovetail' | 'halfBlindDovetail' | 'mortiseTenon' | 'bridle' | 'tongueGroove' | 'spline'
  | 'kanawa' | 'okkakeDaisen' | 'koshikakeAri' | 'kama' | 'watariAgo' | 'hozoSashi' | 'shachiSen' | 'custom'
/** A cut joint: its style and settings (inches; counts are whole numbers). Unused settings are left out. */
export type JoineryParams = {
  style: JoineryStyle
  /** How far the partner goes into the host (tenon length, splice length, lap/finger depth). */
  depth?: number
  /** Tenon/tongue/spline thickness; dowel or loose-tenon size; finger width. */
  size?: number
  count?: number
  /** Shoulders each side across the width (tenons). */
  shoulder?: number
  /** Dovetails: slope 1:n (6 softwood, 8 hardwood); half-blind lap. */
  slope?: number
  lap?: number
  through?: boolean
  haunch?: boolean
  biscuit?: '0' | '10' | '20'
  /** A joint made in the joint designer. */
  customId?: string
}

/** A joint designed on a voxel grid in the joint designer: cells[i + n*(j + n*k)] is 0 (beam A, the host) or 1 (beam B). */
export type CustomJoint = { id: string; name: string; layout: 'inline' | 'cross'; n: number; cells: string; slide: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-' }

export type Joint = {
  id: string
  type: JointType
  hostBoardId: string
  partnerBoardId: string
  params: ButtParams | GrooveParams | PocketParams | MiterParams | JoineryParams
  restore?: JointRestore[]
  /** Formulas for groove width, depth and offset. */
  formulas?: Record<string, string>
}

export type TemplateState = { templateId: string; params: Record<string, number | boolean | string> }

export type Project = {
  /** 2 adds drawings; version 1 files are upgraded when opened. */
  formatVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11
  name: string
  units: 'in'
  boards: Board[]
  joints: Joint[]
  woods: Wood[]
  template?: TemplateState
  /** Drawings (sketches) — shaped parts point into these. */
  sketches?: Sketch[]
  /** Named sizes. */
  sizes?: SizeDef[]
  /** Layout rules (spacing, centred, gap, count). */
  rules?: Rule[]
  /** Groups / assemblies (a tree). */
  groups?: Group[]
  /** Dimensions and notes kept on the model. */
  annotations?: Annotation[]
  /** Pictures to design over. */
  references?: Reference[]
  /** Shop Mode progress for this design's generated steps. */
  shopProgress?: ShopProgressData
  /** Hinges, slides, pulls, screws… used in this design. */
  hardware?: HardwareUse[]
  /** This project's own hardware items, and price changes to built-in ones (same id). */
  hardwareItems?: HardwareItem[]
  /** Outside 3D models to design around. */
  models?: RefModel[]
  /** Cutting allowances, waste and tax for layouts and the shopping list. */
  cutSettings?: CutSettings
  /** Joints designed in the joint designer. */
  customJoints?: CustomJoint[]
  /** How the piece gets finished: prep, colour, seal, topcoats, rub-out. */
  finish?: FinishSchedule
}

export const SQUARE: EndCut = { miter: 0, bevel: 0 }
