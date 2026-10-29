# Shop Mode & Reference Tracing — Design (Piece 3D)

Date: 2026-10-29
Status: decided by Claude under Adam's "run straight through" instruction; Adam can redirect at any time
Builds on: My Plans (17), Drawing board (7A), Assemblies (3B)

## 1. Purpose

Take the design to the bench: a big-text, one-step-at-a-time view that's readable from a few feet away
with sawdust on your hands. And start a design from a picture: put a photo or scan behind the 3D view or the
drawing board, scale it with one known measurement, and trace over it.

## 2. Shop Mode

- **Where:** a **Shop Mode** button in the Master Shop toolbar and in My Plans (on a plan with steps). Kids'
  project sheets get the same view as "Shop Mode" on the kids' side (kid-sized words, the same controls).
- **What it shows:** full screen, dark-on-light high contrast, very large text (step title 48 px, body 32 px),
  one step at a time: step number "Step 3 of 12", the step's text, its photo or the design's 3D view of the
  parts the step names, the tools and the parts (with cut sizes from the cut list) for that step, and
  "Adult does this" marks from the kids' permissions on kid plans.
- **Steps come from:** a plan's own steps (My Plans), or — for a design without a plan — generated steps:
  1. Cut list (every part, grouped as in the cut list), 2. one step per joint ("Cut the dado in Side for
  Shelf — 3/4" wide, 1/4" deep, 10" from the bottom"), 3. one step per group, inside-out ("Assemble Drawer"),
  4. "Final assembly", 5. finishing (when a finishing schedule exists — Piece 12).
- **Controls:** Next / Back (huge buttons), keyboard ← → / space / PageDown (works with a foot pedal or a
  presentation clicker that sends those keys), a check box per step (progress kept with the plan or design),
  zoom text +/–, a timer (start/stop; time logged per step), Exit (Esc).
- **Screen stays on** while Shop Mode is open (Electron power-save blocker), released on exit.
- **Read aloud** button (uses the kids' read-aloud voice) for the current step.

## 3. Reference images and tracing

- **Reference image** (Master Shop): add a photo or scan (PNG/JPEG/WebP) as a flat picture in the 3D view
  on a chosen plane (front XZ, side YZ, top XY), with opacity, a lock, show/hide, and removal.
  - **Scale it**: click two points on the image and type the real distance between them; the image is
    scaled so that distance is true. Then move it (X/Y/Z) so it lines up.
  - Stored in the project (`Project.references?: Reference[]`, the image embedded as a data URL, up to
    8 MB each — larger pictures are scaled down when added).
- **Trace in the drawing board**: the drawing board gets the same "Reference image" (behind the grid),
  scaled the same way; you draw over it with the normal tools, then turn the shape into a part as today.
- **Parts over an image in 3D** are placed the normal way (typed sizes, move arrows) — ruling: no
  drag-to-trace boards; one precise way of placing parts.

## 4. Data

- `Project.references?: { id, name, plane: 'front'|'side'|'top', dataUrl, width, height (inches after
  scaling), position: Vec3, opacity, locked, hidden }[]` (project format 7).
- `Sketch.reference?: { dataUrl, x, y, width, height, opacity }` for the drawing board.
- Shop progress: `Plan.progress?` (done steps, minutes per step) and for designs `Project.shopProgress?`.

## 5. Testing

Unit: generated steps for templates (cut, joints, groups); progress; reference scaling maths; file round-trip.
UI: Shop Mode navigation, keys, checks, zoom, read aloud call, exit. E2E: open Shop Mode on a bookshelf,
step through with the keyboard, tick a step, exit; add a reference image, scale it from two points.
