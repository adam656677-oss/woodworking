# Doors, Drawers & Hardware — Design (Piece 6)

Date: 2026-10-29
Status: decided by Claude under Adam's "run straight through" instruction; Adam can redirect at any time
Builds on: 1, 3A (sizes), 3B (groups), 3C (interference)

## 1. Purpose

Cabinet work the way Adam does it in 20/20: pick an opening, generate a door or drawer that fits it with the
right reveals and hardware clearances, list the hardware, lay out shelf pins, and swing/slide it in 3D to
check it clears.

## 2. Generators (Master Shop toolbar → Add ▾ → Door / Drawer / Face frame)

All generators make a **group** (3B) named "Door 1", "Drawer 1", "Face frame" with real joints, and add their
hardware. The **opening** is typed (width × height, depth for drawers, position = its lower-left-front corner)
or taken from **"Use the space between the selected parts"** (2 selected parts: the clear space between their
facing sides; 4 parts: the rectangle they frame).

### 2.1 Doors
- Styles: **Slab**; **Shaker** (2 stiles, 2 rails, flat panel in a 1/4" × 3/8" groove; rails get stub tenons
  3/8" long, matching the groove); **Raised panel** (Shaker frame, 5/8" panel with a raised edge profile,
  tongue to 1/4"); **Glass** (frame with a 3/8" × 3/8" rabbet at the back for glass; the glass pane is a
  hardware item "Glass 1/8"" sized to the rabbet less 1/16" each way).
- Mounting: **Full overlay** (door = opening + 1/2" each side covered, so +1" overall), **Half overlay**
  (+1/4" each side), **Inset** (opening − 1/16" each side). Pairs: "Two doors" splits the width with a 1/8"
  gap (overlay) or 1/16" (inset).
- Frame stile and rail widths (default 2-1/4"), wood choice (frame and panel separately).
- Hinges: concealed 35 mm cup hinges matched to the mounting (full/half overlay, inset); count 2 (≤ 40"
  tall), 3 (≤ 60"), 4 (taller); cup holes 1-3/8" Ø × 1/2" deep, centre 7/8" from the hinge edge, 4" from top
  and bottom (more spaced evenly). Hinge side left/right.
- Pull: knob or bar pull with a centre-to-centre size; placement upper/lower corner (3" in) or centred.

### 2.2 Drawers
- Box joinery: butt (screws/glue), rabbet (front and back in 1/2"-wide rabbets in the sides), dado (front
  and back in dados 1/2" from the side ends); a 1/4" plywood bottom in a 1/4" × 1/4" groove 1/2" up.
  (Dovetailed boxes: drawn as rabbet, noted "dovetail" in the cut list — the Joinery Library, Piece 10,
  draws real dovetails.)
- Slides: **side-mount ball-bearing** (box width = opening − 1"; box length = the longest slide length
  10–28" in 2" steps that fits opening depth − 1"), **undermount** (box width = opening − 3/8", box length =
  slide length, bottom recessed 1/2"), **wood runners** (box width = opening − 1/8"). Box height = opening −
  1" (side-mount), − 13/16" (undermount), − 1/8" (runners). Sides/front/back from 1/2" (default) wood.
- Front: **applied front** (false front, mounting like doors: full/half overlay or inset) or **none**.
  Pull like doors (centred by default).
- A note on each generated drawer: "Check your slide maker's instructions — sizes vary".

### 2.3 Face frames
- Outside width × height, stile width (1-1/2"), top rail (1-1/2"), bottom rail (1-1/2"), mid stiles and rails by
  counts across/down (equal openings); joinery pocket screws (from the back) or butt; wood choice.

## 3. Hardware library and list

- Built-in items (description in plain words, typical price editable): concealed hinges (full overlay, half
  overlay, inset), butt hinges 2-1/2", side-mount slides 10–28", undermount slides 12–21", knobs 1-1/4",
  bar pulls 3"/96 mm/128 mm/160 mm, wood screws #6 × 5/8", #8 × 1-1/4", pocket screws 1-1/4" coarse,
  shelf pins 5 mm and 1/4", glass 1/8" (per sq ft). User items can be added (name, kind, price).
- `Project.hardware?: { id, itemId, qty, groupId?, boardId?, note? }[]` (project format 8). Generators add
  theirs; delete a generated group → its hardware goes. Edit qty or remove by hand.
- **Hardware list**: a tab in the Cut List window: item, qty, where, unit price, total — printed with the
  cut list. Glass shows its size.

## 4. Shelf-pin layout (select a side → Shelf pins…)

- Two rows (front and back), 5 mm or 1/4" holes 3/8" deep, rows 1-1/2" in from the front and back edges
  (editable), 32 mm or 1" spacing (editable) from a start height to an end height (from the inside face of the
  bottom to below the top, default 6"–6" in). Holes get a `depth` (project format 8: `Hole.depth?`; through
  when absent). "Mirror to the other side" puts the matching layout on the facing side. Adds shelf pins
  (4 per shelf × shelves) to the hardware list when a shelf rests on them.

## 5. Motion and clearance

- Generated doors know their hinge line; drawers their slide direction and travel (= slide length,
  or box depth − 2" for runners). Stored on the group: `motion?: { kind: 'swing', axis, origin, maxDeg (95 for
  concealed / 180 for butt), dir } | { kind: 'slide', dir, travel }`.
- **Open ▾** in the toolbar: Closed / Half / Open (or a slider) — opens every door and drawer in 3D
  (display only). Clicking a door or drawer's "Open" in its Group panel animates just that one.
- **Clearance check** (Checks → Clearance): steps each moving group from closed to open in 10 steps and
  runs the interference check (3C) against everything else; lists "Door 1 hits Drawer 2 at 60% open"
  and the first blocked position. Overlapping doors at the hinge (expected for concealed hinges) are
  ignored for the door's own carcass side.

## 6. Testing

Unit: every generator's part sizes against hand calculations (Shaker 15 × 30 full overlay; drawer in a 16 ×
6 × 22 opening for each slide type); hinge counts and cup positions; face-frame openings; shelf-pin hole
positions; hardware list totals; motion transforms; clearance finds a door hitting a drawer front and passes
a well-spaced cabinet. E2E: add a Shaker door and a drawer to an opening, check the cut list and hardware
list, open them in 3D, run the clearance check.
