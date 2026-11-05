# A&A unified woodworking workspace checklist

## Product requirement
Design once in one CAD-style workspace. Create Build Plan generates outputs from that exact model; no second editable design or redrawing. Plan previews are read-only output views. Autodesk/Fusion familiarity guides the intended interaction style.

## Verified baseline: commit 914cf3c
Observed 2026-11-03 after the Create Build Plan preview commit:
- Linux verification passed for both push and PR runs.
- Windows installation, type checks, unit tests, and application build passed in PR run 41710774931.
- Windows Electron suite completed: 32 passed, 28 failed, approximately 8.7 minutes.
- The new build-plan interaction test is among the failures; the one-button workflow is not verified.
- Failure diagnostics uploaded successfully. The bounded PR log excerpt omitted the first assertion details.
- Draft PR #1 remains unmerged. No installer or release has been validated.
These results apply to 914cf3c, not to later commits.

## Implemented foundations
- [x] Isolated redesign branch and draft PR #1.
- [x] Project-focused Home dashboard.
- [x] Adjustable adult panels, tabbed Inspector, and command palette.
- [x] 1/64-inch input display improvements and regression tests.
- [x] Cross-platform verification and unsuccessful-run reporting.
- [x] Inspector-aware Electron helpers and Windows process-tree cleanup.
- [x] Immediate failure details and bounded end-of-run first-failure summary authored.

## Single-model build plan: implemented, not release-verified
- [x] createBuildPlan reuses sheet, cut-list, and assembly-step generators.
- [x] Preflight for empty models, invalid measurements, duplicate IDs, and missing materials.
- [x] Model snapshot and conservative stale-plan detection.
- [x] Create Build Plan button and read-only preview.
- [x] Update Plan and stale-plan export guard.
- [x] Existing PDF/print APIs connected; store formula errors block generation.
- [x] Model-to-plan unit tests and an Electron workflow test authored.
- [ ] Resolve and pass the build-plan Electron test.
- [ ] Integrate shopping/hardware lists and full-size templates.
- [ ] Verify output pagination, total numbering, part IDs, and PDF dimensions.
- [ ] Validate stale-plan handling, keyboard/focus behavior, and unchanged model geometry.
- [ ] Expand construction/unsupported-geometry checks and consolidate legacy output controls.

## Immediate verification tasks
- [ ] Read the first failing Electron assertions from the new bounded summary.
- [ ] Separate application regressions, outdated navigation assumptions, and environment problems using evidence.
- [ ] Fix failures without skipping tests or weakening assertions.
- [ ] Obtain full passing Windows Electron results on the latest commit.
- [ ] Confirm latest-commit Linux and Windows type checks, unit tests, and builds.

## Remaining redesign and release gates
- [x] Finish unified navigation and toolbar organization (implemented on Linux; Windows run still to do). One command list (`src/ui/commands.ts`) drives the toolbar groups (File, Create, Modify, Joinery, Inspect, Output), its menus and the Ctrl+K palette; tooltips carry shortcut hints; the toolbar no longer repeats Home and My Plans from the workspace bar; room is left at the right end for the Help button.
- [ ] Direct drawing input, snapping/constraint feedback, and in-project sketch/model editing.
  - [x] Snap and constraint feedback: 3D moves show Corner / Edge / Face / Midpoint / grid labels, highlighted faces, guide lines and a live distance readout; Alt turns snapping off. The drawing sheet shows Endpoint / Midpoint / Center / Crossing / Tangent / grid labels, level and upright guides, a live length-and-angle or size readout, and rule glyphs with plain-word tooltips. Unit tests and `snap-feedback.spec.ts` cover it (Linux only so far).
  - [ ] Direct drawing input beyond typed sizes, and in-project sketch/model editing.
- [ ] Further component, joinery, parametric, fabrication-layout, and Shop Mode improvements.
- [ ] Validate save/recovery, children/adult separation, accessibility, and performance.
- [ ] Build and test the Windows installer.
- [ ] Explicit review and approval before merge/release.

Status: implementation in progress; Windows interaction verification is failing; not release-ready. Checked implementation items are not claims of runtime verification.
