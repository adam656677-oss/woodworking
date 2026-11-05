# A&A Woodworking Studio

Woodworking design software for A&A Woodworking — a Kids' Workshop and a Master Shop on one shared engine.

**Status:** version 1.1.0. Every roadmap piece is built (specs in `docs/superpowers/specs/`), plus the unified
workspace, one-button build plans, in-app Help, a problem log and large-project performance work. Remaining release
gates are tracked in `docs/REDESIGN-CHECKLIST.md`.

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

## What's in it

- **Help:** the **Help** button (Home, the design toolbar, the Kids' Workshop) or **F1** on any screen. Searchable
  "How do I…" topics, a keyboard-shortcuts list, and simpler help for kids.
- **Master Shop:** templates and free-form boards in inches and fractions with snapping (it shows what it snapped to;
  hold Alt to turn it off), joints and the joint designer, Japanese joinery, cabinets, doors, drawers and hardware,
  shaped and turned parts on the Drawing Board, sizes and formulas, groups and motion, 3D import/export, checks
  (interference, weight, clearance), cut list, sheet layout and shopping list, rendering, Shop Mode, Finishing
  School, the wood library and shop tools. The toolbar is grouped File, Create, Modify, Joinery, Inspect, Output,
  and **Ctrl+K** finds any command.
- **Create Build Plan:** one button turns the design into a PDF-ready plan: drawing sheets, part sheets, cut list,
  shopping list, hardware list, assembly steps and full-size templates for curved or turned parts.
- **My Plans:** write plans or bring them in from PDFs, photos, scans and web pages, and print step-by-step guides.
- **Kids' Workshop:** lessons, quizzes, a simple designer, projects with printable sheets, games and badges from
  real built projects and passed quizzes. No streaks, points or currencies.
- **Family:** more than one child, backup and restore, and sharing projects.

## Rebuilding (developers)

Needs Node.js LTS.

```
npm ci
npm test          # model and UI unit tests
npm run e2e       # end-to-end tests that drive the real app
npm run dist      # builds the Windows installer into dist\
```

Or double-click `Build-Installer.bat`.
