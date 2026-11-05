# A&A Woodworking Studio

Woodworking design software for A&A Woodworking — a Kids' Workshop and a Master Shop on one shared engine.

**Status:** Piece 1 of 16 (Design Core) complete. Nothing is released until every piece is done — see
`docs/superpowers/specs/2026-10-27-design-core-design.md` for the full roadmap.

## Install

Run `A&A Woodworking Studio Setup <version>.exe`. It asks where to install, adds a desktop shortcut, and
lets you double-click `.aaw` project files to open them. Windows may warn that the installer is from an
unknown publisher (it isn't code-signed); choose **More info → Run anyway**.

## Where things are saved

- Projects: `Documents\A&A Woodworking\<name>.aaw` (or wherever you choose).
- Every save keeps the previous version next to it as `<name>.aaw.bak`.
- While you work, an autosave is written every 30 seconds to `<name>.aaw.autosave`
  (`Untitled.aaw.autosave` for a project you haven't saved yet). If the app closes unexpectedly, opening
  the project offers to recover it.
- Your own wood stock (the **Woods** button) is kept with the app's settings and copied into each project
  that uses it, so project files are self-contained.

## If something goes wrong

The app keeps a short problem log in `%APPDATA%\A&A Woodworking Studio\logs\aa-studio.log` (about 1 MB per file,
the newest five kept). It lists when the app started (version, Windows and Electron versions), crashes, errors and
failed saves or exports with the file involved — never what is inside your projects. On the Home screen,
**About → Open log folder** opens it; the error screen has the same button. Saves are written to a temporary file,
flushed to disk and swapped in, so a crash during a save can't leave a damaged project; autosaves work the same way.

## What Piece 1 does

- Home screen: **Kids' Workshop** (coming soon) and **Master Shop**.
- Templates: Box (butt or rabbeted corners, optional lid), Bookshelf (dadoed shelves, rabbeted back),
  Birdhouse (screwed butt joints, entry hole). Sizes stay live until **Unlock**.
- Free-form boards: typed sizes in inches and fractions (`11 3/4`, `11-3/4`, `11.75`, `1' 2-1/2"`),
  drag to move with snapping to faces/edges/corners or a 1/16" grid, rotate, duplicate, mirror, align,
  measure, undo/redo.
- Joints: butt (glue/screws/nails), dado, rabbet, pocket screws, miter; any end can be mitered or beveled
  and any edge beveled.
- Cut list: grouped parts, finished sizes (long point for angled parts), joint notes, board feet, sheet
  estimate, cost when prices are set; print or save as CSV.
- Warnings for overlapping parts, parts bigger than your stock, and joints or angles that can't be made.

## Rebuilding (developers)

Needs Node.js LTS.

```
npm ci
npm test          # model and UI unit tests
npm run e2e       # end-to-end tests that drive the real app
npm run dist      # builds the Windows installer into dist\
```

Or double-click `Build-Installer.bat`.
