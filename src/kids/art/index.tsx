// Original, simple drawings for the Kids' Workshop. Each is a 64×64 SVG made for this app.
import type { ReactNode } from 'react'

const WOOD = '#e2b878'
const DARK = '#8a5a2b'
const STEEL = '#9aa5b1'
const RED = '#d6453d'
const BLUE = '#2f80c9'
const YEL = '#f2c230'
const INK = '#3b3226'

const s = (children: ReactNode) => () => (
  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" strokeLinejoin="round" strokeLinecap="round">
    {children}
  </svg>
)

const board = (x: number, y: number, w: number, h: number) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={1.5} fill={WOOD} stroke={DARK} strokeWidth={1.5} />
    <path d={`M${x + 3} ${y + h * 0.35} q ${w / 3} -3 ${w - 6} 0 M${x + 3} ${y + h * 0.7} q ${w / 3} 3 ${w - 6} 0`} fill="none" stroke={DARK} strokeWidth={0.8} opacity={0.6} />
  </g>
)

export const ART: Record<string, () => JSX.Element> = {
  rules: s(<>
    <rect x={14} y={8} width={36} height={48} rx={3} fill="#fff" stroke={INK} strokeWidth={2} />
    <rect x={24} y={4} width={16} height={8} rx={2} fill={STEEL} stroke={INK} strokeWidth={1.5} />
    {[20, 30, 40].map(y => <g key={y}><path d={`M20 ${y} l3 3 l5 -6`} fill="none" stroke="#3a9d4f" strokeWidth={2.5} /><path d={`M32 ${y + 1} h12`} stroke={INK} strokeWidth={2} /></g>)}
  </>),
  goggles: s(<>
    <path d="M6 30 q0 -10 12 -10 h28 q12 0 12 10 v6 q0 8 -10 8 h-6 q-6 0 -8 -6 q-2 6 -8 6 h-6 q-10 0 -10 -8 z" fill="#bfe3f7" stroke={INK} strokeWidth={2} />
    <path d="M6 30 h-4 M58 30 h4" stroke={INK} strokeWidth={3} />
    <path d="M14 28 l6 -4 M40 28 l6 -4" stroke="#fff" strokeWidth={2} />
  </>),
  'ear-muffs': s(<>
    <path d="M14 38 q0 -30 18 -30 q18 0 18 30" fill="none" stroke={INK} strokeWidth={4} />
    <ellipse cx={14} cy={42} rx={8} ry={11} fill={RED} stroke={INK} strokeWidth={2} />
    <ellipse cx={50} cy={42} rx={8} ry={11} fill={RED} stroke={INK} strokeWidth={2} />
  </>),
  'dust-mask': s(<>
    <path d="M12 28 q20 -14 40 0 q-2 20 -20 22 q-18 -2 -20 -22 z" fill="#fff" stroke={INK} strokeWidth={2} />
    <path d="M12 28 l-6 -6 M52 28 l6 -6 M12 34 l-6 4 M52 34 l6 4" stroke={INK} strokeWidth={2} />
    <path d="M22 34 q10 4 20 0" fill="none" stroke={STEEL} strokeWidth={2} />
  </>),
  'first-aid': s(<>
    <rect x={8} y={16} width={48} height={36} rx={4} fill="#fff" stroke={INK} strokeWidth={2} />
    <rect x={24} y={10} width={16} height={8} rx={2} fill="none" stroke={INK} strokeWidth={2} />
    <path d="M32 24 v20 M22 34 h20" stroke={RED} strokeWidth={7} />
  </>),
  'tape-measure': s(<>
    <rect x={6} y={14} width={30} height={30} rx={8} fill={YEL} stroke={INK} strokeWidth={2} />
    <circle cx={21} cy={29} r={6} fill="#fff" stroke={INK} strokeWidth={1.5} />
    <rect x={34} y={36} width={26} height={8} fill="#fff8d6" stroke={INK} strokeWidth={1.5} />
    {[38, 42, 46, 50, 54].map((x, i) => <path key={x} d={`M${x} 36 v${i % 2 ? 3 : 5}`} stroke={INK} strokeWidth={1} />)}
    <path d="M60 34 v12" stroke={INK} strokeWidth={2} />
  </>),
  pencil: s(<>
    <path d="M12 52 l6 -16 l28 -28 l10 10 l-28 28 z" fill={YEL} stroke={INK} strokeWidth={2} />
    <path d="M12 52 l6 -16 l10 10 z" fill="#f4d9b0" stroke={INK} strokeWidth={1.5} />
    <path d="M12 52 l2 -6 l4 4 z" fill={INK} />
    <path d="M46 8 l10 10" stroke="#e78fa6" strokeWidth={5} />
  </>),
  'hand-saw': s(<>
    <path d="M14 22 l44 8 l-2 10 l-42 -4 z" fill={STEEL} stroke={INK} strokeWidth={2} />
    <path d={Array.from({ length: 10 }, (_, i) => `M${16 + i * 4} ${36.2 + i * 0.4} l2 3 l2 -3`).join(' ')} fill="none" stroke={INK} strokeWidth={1} />
    <path d="M4 18 h12 q4 0 4 4 v14 q0 4 -4 4 h-8 q-4 0 -4 -4 z" fill={RED} stroke={INK} strokeWidth={2} />
    <rect x={8} y={24} width={7} height={10} rx={2} fill="#fff" />
  </>),
  'miter-box': s(<>
    <path d="M6 30 h52 v20 h-52 z" fill={WOOD} stroke={DARK} strokeWidth={2} />
    <path d="M6 30 v-12 h8 v12 M50 30 v-12 h8 v12" fill={WOOD} stroke={DARK} strokeWidth={2} />
    <path d="M28 18 v14 M36 18 v14" stroke={INK} strokeWidth={1.5} strokeDasharray="2 2" />
  </>),
  hammer: s(<>
    <rect x={28} y={20} width={8} height={40} rx={3} fill={DARK} stroke={INK} strokeWidth={2} />
    <path d="M12 10 h30 l8 4 v8 l-8 0 h-30 z" fill={STEEL} stroke={INK} strokeWidth={2} />
    <path d="M50 14 q8 -2 8 -8" fill="none" stroke={INK} strokeWidth={3} />
  </>),
  nail: s(<>
    <path d="M20 12 h24" stroke={STEEL} strokeWidth={6} />
    <path d="M32 14 v38 l-3 -4 h6 l-3 4" fill={STEEL} stroke={INK} strokeWidth={2} />
    {board(8, 44, 48, 14)}
  </>),
  sandpaper: s(<>
    <rect x={10} y={14} width={44} height={36} rx={2} fill="#e8c88f" stroke={INK} strokeWidth={2} />
    {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={14 + ((i * 37) % 36)} cy={18 + ((i * 23) % 28)} r={0.9} fill={DARK} />)}
    <text x={32} y={36} textAnchor="middle" fontSize={11} fontWeight="bold" fill={INK}>120</text>
  </>),
  drill: s(<>
    <path d="M10 14 h30 q6 0 6 6 v4 q0 6 -6 6 h-30 z" fill={BLUE} stroke={INK} strokeWidth={2} />
    <path d="M46 20 h14" stroke={STEEL} strokeWidth={3} />
    <path d="M18 30 l-4 18 h14 l2 -18" fill={BLUE} stroke={INK} strokeWidth={2} />
    <rect x={10} y={46} width={24} height={10} rx={2} fill={INK} />
  </>),
  screw: s(<>
    <ellipse cx={32} cy={12} rx={12} ry={4} fill={STEEL} stroke={INK} strokeWidth={2} />
    <path d="M28 12 h8 M32 9 v6" stroke={INK} strokeWidth={1.5} />
    <path d="M24 14 l8 44 l8 -44" fill={STEEL} stroke={INK} strokeWidth={2} />
    {[22, 30, 38, 46].map(y => <path key={y} d={`M${26 + (y - 14) / 8} ${y} l${12 - (y - 14) / 4} -3`} stroke={INK} strokeWidth={1.2} />)}
  </>),
  screwdriver: s(<>
    <rect x={8} y={26} width={22} height={12} rx={5} fill={RED} stroke={INK} strokeWidth={2} />
    <path d="M30 32 h22 l6 -3 v6 l-6 -3" fill={STEEL} stroke={INK} strokeWidth={2} />
  </>),
  clamp: s(<>
    <path d="M10 10 h10 v44 h-10 z" fill={STEEL} stroke={INK} strokeWidth={2} />
    <path d="M20 14 h26 v6 h-26 M20 46 h26 v6 h-26" fill={RED} stroke={INK} strokeWidth={2} />
    {board(24, 24, 22, 18)}
  </>),
  glue: s(<>
    <path d="M22 22 h20 v34 h-20 z" fill="#fff" stroke={INK} strokeWidth={2} />
    <path d="M26 22 l2 -8 h8 l2 8" fill={YEL} stroke={INK} strokeWidth={2} />
    <path d="M32 14 v-8" stroke={INK} strokeWidth={2} />
    <rect x={24} y={30} width={16} height={14} fill={YEL} />
  </>),
  square: s(<>
    <path d="M10 10 h10 v34 h34 v10 h-44 z" fill={STEEL} stroke={INK} strokeWidth={2} />
    <path d="M10 10 h10 v24 h-10 z" fill={DARK} stroke={INK} strokeWidth={2} />
    {[24, 30, 36, 42, 48].map(x => <path key={x} d={`M${x} 44 v4`} stroke={INK} strokeWidth={1} />)}
  </>),
  jigsaw: s(<>
    <path d="M10 18 q0 -8 10 -8 h24 q10 0 10 8 v14 h-44 z" fill={YEL} stroke={INK} strokeWidth={2} />
    <path d="M22 18 h20" stroke={INK} strokeWidth={4} />
    <rect x={8} y={32} width={48} height={6} fill={STEEL} stroke={INK} strokeWidth={1.5} />
    <path d="M30 38 v18 l2 -2 l2 2 v-18" fill={STEEL} stroke={INK} strokeWidth={1.5} />
  </>),
  'scroll-saw': s(<>
    <path d="M10 52 h44 v6 h-44 z" fill={INK} />
    <rect x={8} y={38} width={48} height={6} fill={STEEL} stroke={INK} strokeWidth={1.5} />
    <path d="M14 38 v-26 h30 v8" fill="none" stroke={BLUE} strokeWidth={6} />
    <path d="M44 20 v24" stroke={INK} strokeWidth={1.5} />
    <path d="M14 44 v8" stroke={BLUE} strokeWidth={6} />
  </>),
  sander: s(<>
    <ellipse cx={32} cy={46} rx={22} ry={7} fill={INK} />
    <path d="M14 44 q0 -24 18 -24 q18 0 18 24 z" fill="#2fa36b" stroke={INK} strokeWidth={2} />
    <circle cx={32} cy={30} r={5} fill={INK} />
  </>),
  finish: s(<>
    <path d="M14 24 h28 v30 h-28 z" fill="#9a5d2e" stroke={INK} strokeWidth={2} />
    <path d="M14 24 q14 -6 28 0" fill="#c98a52" stroke={INK} strokeWidth={2} />
    <rect x={18} y={34} width={20} height={10} fill="#fff" />
    <path d="M44 10 l12 12 l-6 6 l-12 -12 z" fill={DARK} stroke={INK} strokeWidth={1.5} />
    <path d="M38 16 l-6 10" stroke="#c98a52" strokeWidth={5} />
  </>),
  'table-saw': s(<>
    <rect x={4} y={28} width={56} height={8} fill={STEEL} stroke={INK} strokeWidth={2} />
    <path d="M10 36 v20 M54 36 v20" stroke={INK} strokeWidth={3} />
    <path d="M24 28 a10 10 0 0 1 20 0" fill={STEEL} stroke={RED} strokeWidth={2.5} />
  </>),
  'miter-saw': s(<>
    <rect x={8} y={48} width={48} height={8} fill={STEEL} stroke={INK} strokeWidth={2} />
    <path d="M14 48 v-24 l14 -10" fill="none" stroke={INK} strokeWidth={3} />
    <circle cx={36} cy={30} r={13} fill={STEEL} stroke={RED} strokeWidth={2.5} />
    <path d="M26 16 h22 v10 h-22 z" fill={YEL} stroke={INK} strokeWidth={2} />
  </>),
  router: s(<>
    <rect x={18} y={10} width={28} height={26} rx={6} fill="#6c6f7a" stroke={INK} strokeWidth={2} />
    <path d="M10 36 h44 v8 h-44 z" fill={STEEL} stroke={INK} strokeWidth={2} />
    <path d="M30 44 v8 l2 4 l2 -4 v-8" fill={STEEL} stroke={INK} strokeWidth={1.5} />
    <circle cx={14} cy={26} r={5} fill={INK} /><circle cx={50} cy={26} r={5} fill={INK} />
  </>),
  lathe: s(<>
    <rect x={4} y={46} width={56} height={6} fill={INK} />
    <rect x={6} y={22} width={12} height={24} fill={BLUE} stroke={INK} strokeWidth={2} />
    <rect x={48} y={28} width={10} height={18} fill={BLUE} stroke={INK} strokeWidth={2} />
    <path d="M18 34 q15 -10 30 0 q-15 10 -30 0 z" fill={WOOD} stroke={DARK} strokeWidth={2} />
  </>),
  'brad-nailer': s(<>
    <path d="M10 14 h34 q8 0 8 8 v4 h-42 z" fill={STEEL} stroke={INK} strokeWidth={2} />
    <path d="M44 26 v24 h8 v-24" fill={INK} />
    <path d="M14 26 l-4 22 h12 l4 -22" fill={RED} stroke={INK} strokeWidth={2} />
  </>),
  'block-plane': s(<>
    <path d="M8 40 h48 v10 h-48 z" fill={BLUE} stroke={INK} strokeWidth={2} />
    <path d="M14 40 q18 -24 36 0" fill={BLUE} stroke={INK} strokeWidth={2} />
    <path d="M30 40 l8 -18" stroke={STEEL} strokeWidth={4} />
    <path d="M56 48 q6 -2 6 -10" fill="none" stroke={WOOD} strokeWidth={3} />
  </>),
  'rotary-tool': s(<>
    <rect x={8} y={24} width={36} height={14} rx={7} fill="#7d55c7" stroke={INK} strokeWidth={2} />
    <path d="M44 28 h8 v6 h-8" fill={STEEL} stroke={INK} strokeWidth={1.5} />
    <circle cx={57} cy={31} r={4} fill={STEEL} stroke={INK} strokeWidth={1.5} />
  </>),
  tree: s(<>
    <rect x={28} y={38} width={8} height={20} fill={DARK} />
    <circle cx={32} cy={24} r={16} fill="#4caf50" stroke="#2e7d32" strokeWidth={2} />
    <circle cx={22} cy={30} r={9} fill="#5cbf60" /><circle cx={42} cy={30} r={9} fill="#5cbf60" />
  </>),
  log: s(<>
    <rect x={14} y={20} width={44} height={24} rx={2} fill={DARK} />
    <ellipse cx={14} cy={32} rx={10} ry={12} fill={WOOD} stroke={DARK} strokeWidth={2} />
    {[8, 5, 2].map(r => <ellipse key={r} cx={14} cy={32} rx={r * 0.8} ry={r} fill="none" stroke={DARK} strokeWidth={1} />)}
  </>),
  boards: s(<>{board(6, 14, 52, 10)}{board(6, 28, 52, 10)}{board(6, 42, 52, 10)}</>),
  'wood-grain': s(<>
    <rect x={8} y={8} width={48} height={48} rx={2} fill={WOOD} stroke={DARK} strokeWidth={2} />
    {[16, 24, 32, 40, 48].map((y, i) => <path key={y} d={`M10 ${y} q12 ${i % 2 ? -5 : 5} 22 0 q12 ${i % 2 ? 5 : -5} 22 0`} fill="none" stroke={DARK} strokeWidth={1.2} />)}
  </>),
  plywood: s(<>
    {[0, 1, 2, 3, 4].map(i => <rect key={i} x={8} y={18 + i * 6} width={48} height={6} fill={i % 2 ? '#d4a865' : WOOD} stroke={DARK} strokeWidth={1} />)}
  </>),
  'pencil-holder': s(<>
    <path d="M18 24 h28 v30 h-28 z" fill={WOOD} stroke={DARK} strokeWidth={2} />
    <path d="M18 24 l6 -4 h28 l-6 4 M46 24 l6 -4 v30 l-6 4" fill="#d9a85f" stroke={DARK} strokeWidth={2} />
    <path d="M26 22 l-4 -16 M34 22 l2 -18 M40 22 l6 -14" stroke={YEL} strokeWidth={3} />
  </>),
  'tic-tac-toe': s(<>
    <rect x={6} y={6} width={52} height={52} rx={2} fill={WOOD} stroke={DARK} strokeWidth={2} />
    <path d="M24 10 v44 M40 10 v44 M10 24 h44 M10 40 h44" stroke={DARK} strokeWidth={4} />
    <path d="M12 12 l8 8 M20 12 l-8 8" stroke={RED} strokeWidth={2.5} />
    <circle cx={32} cy={32} r={4.5} fill="none" stroke={BLUE} strokeWidth={2.5} />
  </>),
  birdhouse: s(<>
    <path d="M16 30 h32 v26 h-32 z" fill={WOOD} stroke={DARK} strokeWidth={2} />
    <path d="M10 32 l22 -22 l22 22" fill="none" stroke={RED} strokeWidth={5} />
    <circle cx={32} cy={40} r={5} fill={INK} />
  </>),
  'picture-frame': s(<>
    <rect x={8} y={10} width={48} height={44} fill={WOOD} stroke={DARK} strokeWidth={2} />
    <rect x={16} y={18} width={32} height={28} fill="#bfe3f7" stroke={DARK} strokeWidth={2} />
    <circle cx={26} cy={28} r={4} fill={YEL} /><path d="M16 46 l12 -10 l8 6 l12 -12 v16 z" fill="#4caf50" />
  </>),
  toolbox: s(<>
    <path d="M8 30 h48 v24 h-48 z" fill={WOOD} stroke={DARK} strokeWidth={2} />
    <path d="M12 30 v-16 M52 30 v-16" stroke={DARK} strokeWidth={4} />
    <path d="M12 16 h40" stroke={DARK} strokeWidth={5} />
    <path d="M22 30 l-4 -10 M40 30 l6 -12" stroke={STEEL} strokeWidth={3} />
  </>)
}

/** One drawing by name; an unknown name draws nothing (the content check catches it first). */
export function Art({ name, className }: { name: string; className?: string }) {
  const Draw = ART[name]
  return <span className={className} aria-hidden>{Draw ? <Draw /> : null}</span>
}
