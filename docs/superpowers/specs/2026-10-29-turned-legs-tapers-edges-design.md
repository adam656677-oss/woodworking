# Turned Legs, Tapers & Edge Profiles — Design (Piece 7B)

Date: 2026-10-29
Status: approved in conversation (three sections), awaiting written-spec review
Builds on: Design Core (Piece 1), Kids' Workshop (Piece 2), Drawing Board & Shaped Parts (Piece 7A)

## 1. Purpose

Adam can design the parts that make furniture look finished: square-to-round turned legs, tapered legs,
and shaped edges. Each stays an ordinary board sized to its blank, so joints, contact, stock checks and
the cut list keep working.

**Success:** Adam turns a 1-3/4" leg with a vase profile, sees it in 3D and prints a turning sheet to set
his calipers; tapers a leg on its two inside faces and prints the taper-jig numbers; rounds over a
tabletop's top edges and an arched apron's edge; his son rounds the edges of a project in the Simple
Designer.

### Said by Adam vs. assumed (all confirmed in conversation)

| Said by Adam | Assumed and confirmed |
|---|---|
| Turning: square-to-round legs | Ready-made styles that produce an editable profile (option 1) |
| Edge profiles shown in 3D and noted in the cut list | Roundover, chamfer, cove, ogee; no router setup sheet, no custom bits |
| Tapers: two inside faces, all four, one face, with jig numbers | A turned leg can't also be tapered |
| Edge banding: not now | Kids get roundover and chamfer only (1/8", 1/4") |

Constraints carried forward: Windows desktop, inches only, offline, everything tested; nothing ships until
all pieces are complete.

## 2. Turned legs

### 2.1 Screen
- Properties → **Turning** section → **Turn this leg**. Needs a square blank (|width − thickness| ≤ 1/64");
  otherwise: "Turning needs a square blank — like a 2x2 or a 1-3/4" × 1-3/4" glued-up blank."
- Settings:
  - **Style:** straight taper, bead & cove, vase, ball foot.
  - **Top pommel** (square from the top end; default 5").
  - **Square foot** at the bottom (default 0 = round to the end).
  - **Shoulder:** crisp, or rounded "lamb's tongue".
  - **Biggest diameter** (default blank width − 1/16"); **smallest diameter** (default 40% of the blank).
  - **Edit profile** opens the drawing board (7A) on the half-profile.
  - **Remove turning** makes it a square blank again.
- **Turning sheet** (printable, portrait): full-size profile (tiled like 7A's full-size print), a table of
  stations (distance from the top, diameter to 1/32"), and the pommel and foot layout marks.

### 2.2 Profile drawing
- A 7A drawing in precise mode. x = distance from the leg's top end (inches), y = radius.
- Guide (construction) lines: the centreline (y = 0) and the blank's edge (y = blank/2).
- The profile is an **open chain** of lines/arcs/curves from x = top pommel to x = length − foot.
- Styles generate the chain from the settings; after editing, the drawing is the truth and the style shows
  "custom".
- **Stations:** every profile point plus every 2"; diameters = 2 × radius, rounded to 1/32".

### 2.3 Data
`Board.turning? = { sketchId, style: 'taper'|'beadCove'|'vase'|'ballFoot'|'custom', top, bottom, shoulder: 'crisp'|'lambsTongue' }`

### 2.4 Model and 3D
- Width × thickness × length stay the blank. Cut list row = the blank, note
  `Turned — <top>" pommel[, <bottom>" foot] (see turning sheet)`.
- 3D: square boxes for the pommel and foot, the profile revolved (lathe) between them along the board's
  length axis; joint cuts still subtracted.
- **Problems:**
  - "The turning is wider than the blank (max <blank>")" — the change is refused.
  - "The profile must run from the pommel to the foot without gaps" — the leg shows square, with a warning.
  - A profile that crosses the centreline is refused the same way.

## 3. Tapers

### 3.1 Screen
- Properties → **Taper** section → **Taper this part**. Hidden on a turned leg ("A turned leg is shaped by
  its profile").
- Settings:
  - **Faces:** two inside, all four, or one face. An end-view square with four clickable faces; for
    "two inside", the faces toward the middle of the design are chosen to start.
  - **Start:** distance from the top. Default: the lowest apron/rail joined to it, + 1/2"; else 5".
  - **Size at the foot.**
- **Taper sheet** (printable), per face:
  - start mark
  - amount removed at the foot
  - angle (to 0.1°)
  - jig opening at 12" = 12 × removed ÷ taper length
  - the cutting order. For two adjacent faces: "cut face A, turn the leg so A faces up, cut face B". For
    four faces: "cut two opposite faces, tape the offcuts back on, then cut the other two".

### 3.2 Data and maths
`Board.taper? = { faces: ('left'|'right'|'top'|'bottom')[], start, foot }` — the faces are the board's
long faces: left/right edges (along the width) and top/bottom faces (along the thickness).

- Taper length L = board length − start.
- Removed at the foot, per face: one face, or two faces on different axes: (size − foot); two faces on the
  same axis, or all four: (size − foot) / 2. Size is the width or thickness on that axis.
- The angle is atan(removed / L).

### 3.3 Model and 3D
- The cut list row = the blank, note
  `Taper <n> face(s): <size>" → <foot>" over <L>", starting <start>" from the top`.
- 3D: plane cuts subtracted (as end cuts are now).
- **Problems** (the change is refused):
  - "The foot can't be bigger than the leg"
  - "The taper can't start below the foot"
  - "The foot must be at least 1/4""

## 4. Edge profiles

### 4.1 Screen
- Properties → **Edges** section: add a profile, choose the type and size, tick the edges.
  - **Types:** roundover, chamfer, cove, ogee (roman ogee).
  - **Sizes:** 1/8, 1/4, 3/8, 1/2 or typed.
  - **Edges:** checkboxes for the top face's four edges (left, right, start, end) and the bottom face's
    four, plus quick buttons "All top edges" and "All edges".
- Shaped parts (7A): the edge choice is "top outline" / "bottom outline" (and cutouts); the profile
  follows the curve.
- Kids (Simple Designer): roundover and chamfer only, 1/8" and 1/4", labelled "Round the edges (sand, or
  router with a grown-up)". Turning and taper are hidden there; parts that have them still display.

### 4.2 Data
`Board.edges?: { id, profile: 'roundover'|'chamfer'|'cove'|'ogee', size, face: 'top'|'bottom', sides: ('left'|'right'|'start'|'end'|'outline')[] }[]`

### 4.3 Model and 3D
- Cut list note per profile: `1/4" roundover — top edges (all 4)` / `— top: left, right`. The profiles
  are part of a part's identity for grouping.
- 3D: a cutter of the profile's cross-section (size × size) is extruded along each chosen straight edge
  and subtracted. Where two meet at a corner the result is a mitred meeting.
- Shaped outlines: the outline's top (or bottom) layer is rebuilt as stacked insets (8 layers through the
  profile depth, each inset by the profile's curve at that depth) — the look of a bearing-guided bit.
- **Problems** (the change is refused):
  - "A <size> <type> is too big for this board" — the size is over the thickness, over half the width, or
    a top and bottom profile on one edge together exceed the thickness.
  - "Profiles can't go on a turned section" — only the pommel or foot can be profiled; side edges of a
    turned leg are not offered.

## 5. File format

Project format **version 3** (adds `turning`, `taper`, `edges` to boards); version 2 files migrate
unchanged, and an older app says the file was made with a newer version. Damaged values get the usual
"isn't a valid A&A project" message; a turning that points at a missing drawing is dropped (the leg is a
square blank), as with shaped parts.

## 6. Testing

**Unit**
- Turning:
  - each style's profile stays inside the blank and runs pommel to foot
  - stations and diameters
  - the 3D lathe volume is within 1% of the analytic volume (straight taper = frustum)
  - wider-than-blank is refused
  - a broken profile gives the warning and a square display
- Taper maths, checked against hand-worked cases:
  - 1-1/2 → 7/8 over 23-1/2 on two adjacent faces: 5/8 removed per face, 1.5°, jig 0.319" at 12"
  - the same on all four faces
- Taper: the 3D foot cross-section equals the foot size.
- Edges:
  - each profile's cross-section area matches its formula (roundover r: r² − πr²/4)
  - size limits
  - notes and grouping
  - a shaped part's top-outline profile
- File: v2 → v3 migration; round-trip with all three features; damaged values.

**End-to-end (real app)**
1. Turn a 1-3/4" leg (vase) and print the turning sheet.
2. Taper a leg on two inside faces; the cut list note; the taper sheet.
3. Roundover the top edges of a tabletop and of an arched apron; the cut list notes.
4. Kids: roundover in the Simple Designer.

## 7. Out of scope (7B)

Bowls, faceplate work, pens; router setup sheets; custom bit profiles; edge banding; fluting, reeding and
spiral turnings; carving.
