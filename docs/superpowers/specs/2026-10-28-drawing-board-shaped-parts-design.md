# Drawing Board & Shaped Parts — Design (Piece 7A)

Date: 2026-10-28
Status: approved in conversation (three sections), awaiting written-spec review
Builds on: Design Core (Piece 1), Kids' Workshop (Piece 2), My Plans (Piece 17)
Followed by: Piece 7B — Turned Parts, Tapers & Edge Profiles (reuses this drawing board)

## 1. Purpose

Adam asked for the ability to draw 2D shapes (and later 3D models), for shaped parts, scroll-saw and
jigsaw patterns, turned parts and router edge profiles. Piece 7 is split: **7A** (this spec) is the
drawing board and shaped parts; **7B** is turned parts, tapers and edge profiles.

**Success:** Adam draws an arched apron with exact dimensions, makes it a part cut from a 1x6, sees
the real shape in 3D, gets a correct cut list, prints the shape full size to trace, and exports DXF
for a CNC. His son freehands a heart, makes it a part, and prints the pattern.

### Said by Adam vs. assumed (all confirmed in conversation)

| Said by Adam | Assumed and confirmed |
|---|---|
| Uses: shaped parts, patterns, turned parts, edge profiles | Split into 7A (this) and 7B |
| Two modes: precise CAD for him, freehand for his son | Freehand smooths strokes into curves and straight lines |
| May get a CNC or laser later | DXF (R12) and SVG export in inches now |
| Geometry approach: own shape model + FreeCAD's constraint solver | planegcs (WASM, LGPL-2.0-or-later, used unmodified) |

Constraints carried forward: Windows desktop, inches only, offline, everything tested; nothing ships
until all pieces are complete.

## 2. Screens

### 2.1 Getting there
- Master Shop toolbar: **Draw a shape** (new drawing). With one board selected: **Edit shape**.
- Kids' Workshop home: **Draw It!** tile (freehand mode).

### 2.2 The drawing board
A top-down sheet: 1" grid (1/8" fine grid when zoomed in), inch rulers, pan and zoom, and — when
shaping an existing board — that board's rectangle drawn faintly underneath.

**Precise mode (Adam)**
- Draw: line, rectangle, arc (3-point and center–radius), circle, spline (through points), text,
  construction line.
- Modify: trim, extend, offset, mirror, fillet (radius) and chamfer at a corner, delete, undo/redo.
- Snaps: endpoint, midpoint, center, intersection, tangent, grid.
- Typed input while drawing: length (`11-3/4`), angle (`@45`).
- Dimensions: linear (horizontal, vertical, aligned), radius, diameter, angle — shown as labels;
  double-click to type a new value (inch parser from Piece 1).
- Constraints (buttons): horizontal, vertical, perpendicular (square), parallel, equal, tangent,
  concentric, coincident, fixed, symmetric.
- Feedback colours: **blue** = can still move, **black** = fully constrained, **red** = conflicting;
  conflicts are listed with "Remove one of these".

**Freehand mode (son)**
- Draw with mouse or finger; on release the stroke is smoothed into lines, arcs and curves.
- Tap a shape to select and drag it. Big buttons: Circle, Heart, Star, Letters, Undo.
- No constraints; a **Size** box sets the shape's overall width (height follows) in inches,
  rounded to 1/8".

### 2.3 Using a drawing
- **Cut a board to this shape** — choose the wood; the closed outer loop becomes the part's outline,
  closed loops inside it become cutouts, circles inside become holes. The bounding rectangle the part
  is cut from is shown dotted.
- **Print full size** — true 1:1 on letter pages (§4).
- **Export** — DXF or SVG (§5).
- Drawings are saved in the project; a drawing not yet made into a part is kept in the project's
  **Drawings** list.

## 3. Data

Project file format becomes **version 2**. A migration upgrades version 1 files (adds an empty
`sketches` list); nothing else changes, so old files open unchanged.

```
Sketch = {
  id, name,
  points:   { id, x, y, fixed? }[]                       // inches, snapped to 1/64 when stored
  entities: ( { id, kind: 'line', a, b, construction? }
            | { id, kind: 'arc', center, start, end }      // counter-clockwise start → end
            | { id, kind: 'circle', center, r }
            | { id, kind: 'spline', points: pointId[] }    // passes through its points
            | { id, kind: 'text', at, text, height } )[]
  constraints: { id, kind, refs: string[], value? }[]     // kinds per §2.2; value for dimensions
  mode: 'precise' | 'freehand'
}
Board.outline? = { sketchId, outer: Loop, holes: Loop[] }  // Loop = ordered list of entity ids
Project.sketches: Sketch[]
```

**Shaped part rules**
- `width` × `length` = the outline's bounding rectangle (in the board's local x/y), so cut list,
  stock checks, joints, contact and saving keep working.
- **Cut list:** the rectangle, with note `Shaped — cut to pattern (print full size)`.
- **3D:** the board is drawn as the outline extruded through its thickness; existing cuts (dados,
  rabbets, holes, miters) are still subtracted.
- **Joints/contact:** use the bounding rectangle (unchanged rules). If a joint's contact area falls
  outside the outline, a warning says "The shape of <part> doesn't reach where it joins <part>".
- Editing the sketch updates the part; deleting the sketch turns the part back into a rectangle
  (with an undo step).

**Solver:** planegcs (`@salusoft89/planegcs` 1.3.0), WASM bundled with the app. Each solve has a
250 ms limit; on failure or conflict the last good geometry is kept.

**Freehand smoothing:** Ramer–Douglas–Peucker simplification (tolerance 1/16"), then runs that fit
a straight line within 1/32" become lines, runs that fit a circle within 1/32" become arcs, the rest
become splines through the simplified points. A closed stroke (ends within 1/4") is closed exactly.

## 4. Full-size printing

- Scale exactly 1:1 (1 inch = 96 CSS px). Letter portrait, 0.5" margins → 7.5" × 10" printable area.
- Tiled with 0.5" overlap; pages labelled by column letter and row number (A1, B1, A2 …) with a small
  map of the layout on page A1.
- Every page: crop/registration marks at the overlap, the part name, and a 1" × 1" check square.
- The print screen says to print at "Actual size / 100%" and to measure the check square.

## 5. Export

- **DXF R12** (ASCII): LINE, ARC, CIRCLE, and splines as POLYLINE (segments every 1/16" of length);
  units inches (`$INSUNITS` = 1); layers `OUTLINE`, `CUTOUTS`, `TEXT`.
- **SVG**: `width`/`height` in `in`, `viewBox` in inches, paths with true arcs (`A`) where possible,
  Y flipped so the drawing reads the same way up.
- Exported from the drawing board or for a shaped part (its outline and cutouts).

## 6. Errors and edge cases

- **Open outline** — gap shown with a red dot and "This outline has a gap — close it to make a part";
  Cut a board stays disabled.
- **Self-crossing outline** — crossing marked red: "The outline crosses itself here."
- **Conflicting constraints** — offenders red and listed; geometry does not move until one is removed.
- **Solver failure or time-out** — last good shape kept; "That change couldn't be solved — undo it or
  remove a dimension." The app never hangs.
- **Shape larger than the stock** — the usual exceeds-stock warning (kid wording in kids' mode).
- **Printer scaling** — the 1" check square reveals it; instructions printed on page A1.
- **Version 1 files** — open unchanged; saved as version 2.

## 7. Testing

**Unit**
- Solver wrapper: a rough rectangle with horizontal/vertical/two dimensions solves exactly to
  10 × 4; an over-constrained sketch reports the conflicting constraint ids; the time limit returns
  the last good geometry.
- Loops: closed-loop detection, gap location, self-crossing location; area and bounding box of an
  outline with arcs; inner loops become cutouts, circles become holes.
- Freehand: a wobbly straight stroke → one line; a wobbly circle stroke → arcs/circle within 1/16";
  a closed heart stroke → closed outline.
- Tiling: a 30" × 14" outline → the expected page grid and overlaps.
- DXF and SVG output match expected text for a rectangle-with-arch fixture.
- File migration v1 → v2.
- Shaped board: cut list row = bounding rectangle with the Shaped note; the 3D mesh's top-face area is
  within 1% of the outline area.

**End-to-end (real app)**
1. Draw an arched apron (30" × 4" with a 2" rise arch), dimensioned; cut it from a 1x6; the cut list
   shows 30" × 4" with the Shaped note.
2. Print full size: correct page count; the check square measures 96 px.
3. Export DXF and SVG; both contain the expected sizes.
4. Kids: freehand a heart, cut it from a 1x8, print the pattern.

## 8. Out of scope (7A)

Turned parts, tapers, edge profiles, fillets on 3D edges (7B); tracing over a photo (Piece 3);
importing DXF/SVG (Piece 18); text as engraved/carved geometry (text is outline only).
