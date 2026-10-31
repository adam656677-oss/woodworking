// Spot the Hazard: a drawn shop with eight dangers. Positions are in the scene's own units (800 × 500);
// the picture in ui/HazardGame.tsx draws each one at the same spot.
export type Hazard = { id: string; name: string; x: number; y: number; r: number; why: string; fix: string }
export type Scene = { width: number; height: number; hazards: Hazard[] }

export const HAZARD_SCENE: Scene = {
  width: 800,
  height: 500,
  hazards: [
    { id: 'cord', name: 'Cord across the floor', x: 330, y: 455, r: 38, why: 'Someone could trip on it — maybe while carrying wood or right next to a running saw.', fix: 'Run cords along the wall or overhead, or use a cord cover.' },
    { id: 'glasses', name: 'Safety glasses on the bench', x: 640, y: 262, r: 32, why: 'Safety glasses only protect you when they are on your face. Chips and dust fly fast.', fix: 'Put them on before any tool starts, and keep them on until you leave the shop.' },
    { id: 'guard', name: 'Blade guard taken off', x: 205, y: 220, r: 40, why: 'The guard keeps fingers away from the blade and stops pieces flying back.', fix: 'Keep the guard on. A grown-up runs the table saw.' },
    { id: 'spill', name: 'Spill on the floor', x: 520, y: 465, r: 30, why: 'A slippery floor near tools can make you fall toward a blade or bit.', fix: 'Wipe spills up right away and put down sawdust or a mat.' },
    { id: 'rags', name: 'Oily rags in a pile', x: 735, y: 430, r: 34, why: 'Rags with oil finish on them heat up as they dry and can catch fire all by themselves.', fix: 'Lay oily rags flat outside to dry, or put them in a metal can of water with a lid.' },
    { id: 'heater', name: 'Open finish can by the heater', x: 85, y: 420, r: 42, why: 'Finish fumes can catch fire, and an open can lets them out right next to something hot.', fix: 'Close the lid and keep finishes away from heaters, flames and sparks.' },
    { id: 'clutter', name: 'Clutter on the saw table', x: 120, y: 185, r: 30, why: 'Loose scraps can hit the blade and shoot out, or push your wood off course.', fix: 'Clear the table before you cut; keep only the piece you are cutting.' },
    { id: 'sleeves', name: 'Loose sleeves at the drill press', x: 455, y: 205, r: 36, why: 'Spinning tools can grab loose sleeves, long hair, strings and jewelry and pull you in.', fix: 'Roll up sleeves, tie back long hair and take off anything that dangles.' }
  ]
}

/** The hazard at this spot, if any. */
export function hazardAt(s: Scene, x: number, y: number): Hazard | null {
  return s.hazards.find(h => Math.hypot(x - h.x, y - h.y) <= h.r) ?? null
}
