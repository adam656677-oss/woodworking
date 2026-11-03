# A&A unified woodworking workspace checklist

## Product requirement
Design once in one CAD-style workspace. Create Build Plan generates outputs from that exact model; no second editable design or redrawing. Plan previews and sheet-layout controls are output views, not another modeling application. Autodesk/Fusion familiarity guides the intended interaction style.

## Implemented foundations, not a finished release
- [x] Isolated redesign branch and draft PR #1.
- [x] Project-focused Home dashboard.
- [x] Adjustable adult side panels and tabbed Inspector.
- [x] Adult command palette.
- [x] 1/64-inch display improvements and regression tests.
- [x] Cross-platform verification workflow and failure reporting.
- [x] Inspector-aware Electron test helpers.
- [x] Windows process-tree cleanup and immediate test-failure reporter authored.

## Single-model build plan
- [x] Add createBuildPlan API reusing existing sheet, cut-list, and assembly-step generators.
- [x] Add preflight checks for empty models, invalid part measurements, duplicate part IDs, and missing material references.
- [x] Capture one source snapshot and add conservative stale-plan detection.
- [x] Add model-to-plan regression tests (execution still required).
- [ ] Connect a primary Create Build Plan button to this API and the existing preview.
- [ ] Integrate shopping/hardware outputs and full-size templates into the unified result.
- [ ] Expose Update Plan when the model changes.
- [ ] Verify PDF/print output, numbering, and shared part IDs across every included section.
- [ ] Expand preflight to formula errors, unsupported geometry, and construction information needing user review.

## Verification and release gates
Historical CI has passed Linux verification and Windows type checks, unit tests, and application builds. Windows Electron runs have failed or timed out. These historical passes do not verify subsequent commits.
- [ ] Confirm the latest commit passes type checks, unit tests, and build on both platforms.
- [ ] Resolve remaining Windows Electron failures and teardown issues.
- [ ] Complete full passing Electron suite; do not count authored tests as passing tests.
- [ ] Validate save/recovery, children/adult separation, accessibility, and performance.
- [ ] Build and test the Windows installer.
- [ ] Review and explicitly approve merge/release.

## Remaining broader redesign
- [ ] Unified workspace navigation and toolbar organization.
- [ ] Direct drawing input, snapping/constraint feedback, and in-project sketch/model editing.
- [ ] Further component, joinery, parametric, fabrication-layout, and Shop Mode improvements.

Status: implementation in progress; not release-ready. This checklist marks implementation milestones separately from verification gates.
