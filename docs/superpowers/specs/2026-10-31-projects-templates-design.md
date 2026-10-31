# Projects & Templates — Design (Piece 16, first batch)

Date: 2026-10-31
Status: decided by Claude under Adam's "run straight through" instruction; Adam can redirect at any time

The roadmap says this piece is "ongoing until release". This first batch adds 6 Master Shop templates and 4 kids'
projects. More can be added later with no code changes for kids' projects (a JSON file, a drawing and a design
function), and one file per template.

## Master Shop templates

All of them stay live until Unlock, which writes them as named sizes and formulas.

- **Side table.** Four square legs (8/4 hardwood), four aprons set 1/4" back from the leg faces, and a top glued
  up from boards edge to edge. Options: top width, depth, height, overhang, apron height, leg wood, apron and top
  wood, and the number of top boards (raised automatically so no board is wider than the stock). Top boards are
  on the 1/64" grid, the last one taking what's left. Tabletop fasteners (two per apron) are in the hardware list,
  so the top can move with the seasons.
- **Workbench.** 2×4 legs, top rails, a 3/4" plywood top with overhang, and an optional lower shelf on its own
  rails. The long rails lap over the leg faces and the short rails over the leg edges; the overhang is capped so
  the frame is at least 12" each way.
- **Base cabinet.** Frameless: a box on a separate toe-kick base set back 3", front and back top rails, and a
  1/4" back inside the 23-1/4" depth. The optional adjustable shelf rests on shelf pins (in the hardware list), is
  1/16" narrower than the inside and set back 1". Doors and drawers come from the Cabinet menu as before.
- **Cutting board.** Strips laid flat and glued edge to edge. Every other strip can be a second wood (it must be
  the same thickness).
- **Step stool.** 1×10 sides and top, a 1×6 lower step in front of the top, set in dados, and a 1×4 back
  stretcher. Height is capped at 1.6 × the depth so it can't tip.
- **Wall shelf.** 1×6 sides, 2–6 evenly spaced shelves (heights snapped to 1/64"), and a hanging rail under the
  top shelf.

**Wood limits.** Each wood setting says which woods suit it (kind and thickness range, e.g. table legs at least
1-1/2" thick). The settings panel only offers those, and a wood that doesn't suit (from an old file or the online
helper) is swapped for the default. Template-owned hardware is replaced on each rebuild; hardware added from the
Cabinet menu is kept.

## Kids' projects

Every part is a straight crosscut from standard lumber, as with the starter projects.

- **Coaster set** (Level 1, ★): four 3-1/2" squares from a 1x4, sanded, with a wipe-on finish.
- **Phone stand** (Level 2, ★): a 1x4 base, a 1x2 lip and a 1x4 back.
- **Bookends** (Level 2, ★★): two L-shapes from a 1x6, screwed from underneath, then painted.
- **Planter box** (Level 3, ★★): a 1x6 box with a bottom raised 3/4" off the ground and drain holes, built
  with outdoor screws.

Every kids' project that drives screws drills pilot holes first (or, for the picture frame, taps starter holes
with the hammer), and the coasters are measured and cut one square at a time.

## Also

Two-edge and two-end contacts (glued-up panels, splices) now pick the same host whichever order the two parts are
asked about in, so template joints between them always check out.

## Testing

- **Every template, at its defaults and with each option** (on/off, choices, and the minimum and maximum of every
  number):
  - there are no warnings;
  - every joint matches a contact that offers it;
  - Unlock rebuilds every part in exactly the same size and place.
- **Kids' projects:** the content check passes, the designs have no warnings, and the order is checked.
- **E2E:** start each new template with no warnings, change the cutting board's strips, and see the new kids'
  projects.
