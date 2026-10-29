# Joinery Library & Joint Designer — Design (Piece 10)

Date: 2026-10-29
Status: decided by Claude under Adam's "run straight through" instruction; Adam can redirect at any time

## 1. New joints in the designer (Joint panel offers them when parts touch the right way)

| Joint | Geometry (cut from the parts, shown in 3D and in shop notes/drawings) | Settings |
|---|---|---|
| Half lap / cross lap | each part cut to half thickness over the overlap | depth split (50/50) |
| Dowel | holes in both parts, dowels as hardware | Ø (1/4, 5/16, 3/8), count, spacing, depth |
| Biscuit | slots (#0/#10/#20) in both parts | size, count |
| Domino-style loose tenon | mortises in both, tenon as hardware | size |
| Box (finger) joint | fingers on both corner parts | finger width, count (auto from width) |
| Through dovetail / half-blind dovetail | tails and pins drawn exactly (1:6 softwood / 1:8 hardwood slope) | tail count, pin width, half-blind lap |
| Mortise & tenon (blind, through, haunched) | mortise in host, tenon on partner (shoulders); partner lengthens by tenon length | tenon thickness (1/3 rule default), length, shoulders, haunch |
| Bridle | open mortise / tenon at a corner | cheek thickness |
| Tongue & groove / spline | groove in both or tongue on one | sizes |

- Each joint's restore bookkeeping, file checks and cut-list notes follow the existing dado pattern; fit
  rules validate sizes ("Tenon is thicker than half the rail — weak") with plain messages.
- Drawer generator (Piece 6) switches its "dovetail (drawn as rabbet)" to real dovetails.

## 2. Japanese joinery

- Joints: **kanawa tsugi**, **okkake daisen tsugi**, **koshikake ari tsugi** (dovetail splice), **kama tsugi**,
  **sampo zashi**, **watari ago**, **hozo sashi** (stub tenon with wedges), **shachi sen** — each as a
  parametric joint between two in-line or crossing beams, drawn exactly, with the cutting sequence.
- Lessons: Japanese saws (ryoba, dozuki, kataba), chisels (oire nomi, tataki), planes (kanna set-up), marking
  (sumitsubo, sashigane), **water-stone sharpening** (grits 1000/6000, flattening, burr, honing guide vs
  freehand).

## 3. Joint designer (Tsugite-style)

- A separate workspace: two beams (sizes, grain direction, species) on a voxel grid (resolution 2–8 per
  side); click voxels to give them to beam A or B; constraints: each beam's material stays connected,
  assembly is possible along a chosen sliding direction (no voxel of A is blocked by B along it), and every
  voxel is reachable by a router/chisel from the faces (fabricability).
- **Feedback** live: can it assemble (and the direction), weak points (thin necks: cross-section < 25% of
  the beam, short grain voxels where grain runs across a neck), friction/contact area, number of separate
  pieces. Colours on the model show weak spots.
- Save a designed joint to the library and use it between two touching parts in the designer.

## 4. Kids level

- Joint puzzle game (Piece 9) uses the same joints; kid pages for butt, lap, dowel, dado, rabbet, box joint
  with "how strong is it?" bars.

## 5. Testing

Unit: each joint's cut geometry (volumes removed, partner length change), restores (add/remove in any
order returns the original), validation messages; dovetail layout maths; voxel designer constraints
(assemblability by direction, connectivity, weak-neck detection) on known cases. E2E: add a mortise and
tenon, check the cut list shows the tenon length; design a lap in the joint designer and use it.
