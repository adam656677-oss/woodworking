// Spot the Hazard: a drawn shop with eight dangers. Positions are in the scene's own units (800 × 500);
// the picture in ui/HazardGame.tsx draws each one at the same spot.
/** `line`: a hazard that runs along a path (the cord) also counts anywhere within `reach` of it. */
export type Hazard = { id: string; name: string; x: number; y: number; r: number; why: string; fix: string; line?: [number, number][]; reach?: number }

// The cord's drawn path: M0 470 C 150 430, 250 480, 330 455 S 430 420, 455 320, as points.
const bez = (p0: number[], p1: number[], p2: number[], p3: number[]) => Array.from({ length: 21 }, (_, i) => {
  const t = i / 20, u = 1 - t
  return [0, 1].map(k => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]) as [number, number]
})
export const CORD: [number, number][] = [...bez([0, 470], [150, 430], [250, 480], [330, 455]), ...bez([330, 455], [410, 430], [430, 420], [455, 320]).slice(1)]
export type Scene = { width: number; height: number; hazards: Hazard[] }

export const HAZARD_SCENE: Scene = {
  width: 800,
  height: 500,
  hazards: [
    { id: 'cord', name: 'Cord across the floor', x: 330, y: 455, r: 38, why: 'Someone could trip on it — maybe while carrying wood or right next to a running saw.', fix: 'Run cords along the wall or overhead, or use a cord cover.', line: CORD, reach: 16 },
    { id: 'glasses', name: 'Safety glasses on the bench', x: 640, y: 262, r: 32, why: 'Safety glasses only protect you when they are on your face. Chips and dust fly fast.', fix: 'Put them on before any tool starts, and keep them on until you leave the shop.' },
    { id: 'guard', name: 'Blade guard taken off', x: 205, y: 220, r: 40, why: 'The guard keeps fingers away from the blade and stops pieces flying back.', fix: 'Keep the guard on. A grown-up runs the table saw.' },
    { id: 'spill', name: 'Spill on the floor', x: 520, y: 465, r: 30, why: 'A slippery floor near tools can make you fall toward a blade or bit.', fix: 'Wipe it up right away, or tell a grown-up.' },
    { id: 'rags', name: 'Oily rags in a pile', x: 735, y: 430, r: 34, why: 'Rags with oil finish on them heat up as they dry and can catch fire all by themselves.', fix: 'Lay oily rags flat outside to dry, or put them in a metal can of water with a lid.' },
    { id: 'heater', name: 'Open finish can by the heater', x: 85, y: 420, r: 42, why: 'Finish fumes can catch fire, and an open can lets them out right next to something hot.', fix: 'Close the lid and keep finishes away from heaters, flames and sparks.' },
    { id: 'clutter', name: 'Clutter on the saw table', x: 120, y: 185, r: 30, why: 'Loose scraps can hit the blade and shoot out, or push your wood off course.', fix: 'Clear the table before anyone cuts; only the piece being cut belongs there.' },
    { id: 'sleeves', name: 'Loose sleeves at the drill press', x: 455, y: 205, r: 36, why: 'Spinning tools can grab loose sleeves, long hair, strings and jewelry and pull you in.', fix: 'Roll up sleeves, tie back long hair and take off anything that dangles.' }
  ]
}

/** The hazard at this spot, if any. */
export function hazardAt(s: Scene, x: number, y: number): Hazard | null {
  const near = (h: Hazard) => !!h.line && h.line.some((p, i) => i > 0 && segDist(x, y, h.line![i - 1], p) <= (h.reach ?? 12))
  return s.hazards.find(h => Math.hypot(x - h.x, y - h.y) <= h.r) ?? s.hazards.find(near) ?? null
}
function segDist(x: number, y: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)
}
