// Turned legs, tapers and edge profiles: the settings stored on a board. Inches.

export type TurnStyle = 'taper' | 'beadCove' | 'vase' | 'ballFoot' | 'custom'
export const TURN_STYLES: TurnStyle[] = ['taper', 'beadCove', 'vase', 'ballFoot', 'custom']

/** A square-to-round leg: square for `top` inches from its top end and `bottom` inches at its foot, turned to a profile between. */
export type Turning = { sketchId: string; style: TurnStyle; top: number; bottom: number; shoulder: 'crisp' | 'lambsTongue' }

/** A board's long faces: left/right are its edges (across the width), top/bottom its faces (across the thickness). */
export type Face = 'left' | 'right' | 'top' | 'bottom'
export const FACES: Face[] = ['left', 'right', 'top', 'bottom']

/** Tapers on the chosen faces, starting `start` inches from the top end, down to `foot` across at the foot. */
export type Taper = { faces: Face[]; start: number; foot: number }

export type EdgeSide = 'left' | 'right' | 'start' | 'end' | 'outline'
export const EDGE_SIDES: EdgeSide[] = ['left', 'right', 'start', 'end', 'outline']
export type ProfileKind = 'roundover' | 'chamfer' | 'cove' | 'ogee'
export const PROFILE_KINDS: ProfileKind[] = ['roundover', 'chamfer', 'cove', 'ogee']

export type EdgeProfile = { id: string; profile: ProfileKind; size: number; face: 'top' | 'bottom'; sides: EdgeSide[] }
