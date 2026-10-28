# Piece 1 walkthrough — 2026-10-27

Driven through the real app (Electron, software WebGL) and checked against hand calculations.

| Check | Result |
|---|---|
| Box default (12 × 8 × 6, Hardwood 4/4) | 2 × Front / Back 3/4 × 6 × 12; 1 × Bottom 3/4 × 6-1/2 × 10-1/2; 2 × Side 3/4 × 6 × 6-1/2 — matches hand calc |
| Box, height 4" | Front / Back and Sides become 4" wide; Bottom unchanged — correct |
| Box, rabbet corners + lid (3D) | rabbets visible at the top corners; Sides 7-1/4 long (6-1/2 + 2 × 3/8) |
| Bookshelf default (30 × 36 × 10, 3/4 ply, 1/4 back) | 1 × Back 7/32 × 29-3/16 × 36; 2 × Side 23/32 × 10 × 36 with 5 dados + back rabbet; 5 × Top / Bottom / Shelf 23/32 × 9-25/32 × 29-1/16 — matches hand calc |
| Bookshelf, height 48" | Sides and back 48"; dado positions re-spaced (3/4", 12-7/32", 23-21/32", 35-3/32", 46-17/32") |
| Birdhouse default | Roof 8-1/2 × 8-1/2; Front/Back 6-1/2 × 8; Sides 5 × 8; Floor 5 × 5; 1-1/4" hole 6" up, centered — matches |
| Birdhouse, wall height 10" | walls 10"; hole stays 6" up |
| No warnings on any template | 0 warnings for all three, before and after size changes |
| Free-form shelf: two 1x10 sides 30" tall 24" apart, shelf at 12", two dados | 2 × Side 3/4 × 9-1/4 × 30 with "3/4" dado × 1/4" deep, 12" from end"; 1 × Shelf 3/4 × 9-1/4 × 24-1/2 (24 + 2 × 1/4) — matches hand calc; 0 warnings; joint menu offered Butt / Dado / Pocket screws |
| Mitered picture frame (e2e test 6) | 4 × Rail / Stile 3/4 × 2 × 14, "45° miter both ends"; 0 warnings |
| 15° beveled edge | cut list note "15° bevel, left edge" |
| Save → reopen | cut list identical |
| Print | landscape page with only the cut list and totals |
| Crash recovery (e2e test 4) | an unsaved rename survived a killed app and was recovered |

Bugs found and fixed during the walkthrough: template dado depth changes didn't move the shelf; reopened
files showed the template name; the camera didn't refit for new parts; the printout started mid-page;
switching a full-width board to wider stock kept the old width.

| Measure tool (Front view, two clicks across the bookshelf) | line and distance label shown (16-3/32") |

Not exercised by automation: dragging with the move handle (snapping is unit-tested; the handle appears
on the selected part).
