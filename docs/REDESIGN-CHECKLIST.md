# A&A unified woodworking workspace checklist

## Product requirement
Design once in one CAD-style workspace. Create Build Plan generates outputs from that exact model; no second editable design or redrawing. Plan previews are read-only output views, not another modeling application. Autodesk/Fusion familiarity guides the intended interaction style.

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
- [x] Add preflight for empty models, invalid part measurements, duplicate part IDs, and missing material references.
- [x] Capture one source snapshot and add conservative stale-plan detection.
- [x] Add model-to-plan regression tests (execution still required).
- [x] Connect Create Build Plan in Design navigation to a read-only generated preview.
- [x] Expose Update Plan and prevent export of a stale plan.
- [x] Reuse the existing print stylesheet and PDF/print APIs.
- [x] Block generation when the current store reports formula errors.
- [x] Add an Electron test for design-to-plan-to-design without changing the parts list.
- [ ] Integrate shopping/hardware outputs and full-size templates into the unified result.
- [ ] Verify PDF/print output, total numbering, and shared part IDs across every included section.
- [ ] Expand preflight to unsupported geometry and construction information needing review.
- [ ] Consolidate legacy drawing-output controls into the unified flow after compatibility review.

## Verification and release gates
Historical CI has passed Linux verification and Windows type checks, unit tests, and builds. Windows Electron runs have failed or timed out. Historical passes do not verify subsequent commits.
- [ ] Confirm the latest commit passes type checks, unit tests, and build on both platforms.
- [ ] Resolve remaining Windows Electron failures and teardown issues.
- [ ] Complete full passing Electron suite; authored tests are not passing tests.
- [ ] Validate plan preview focus/keyboard handling, stale-plan behavior, and PDF/print results.
- [ ] Validate save/recovery, children/adult separation, accessibility, and performance.
- [ ] Build and test the Windows installer.
- [ ] Review and explicitly approve merge/release.

## Remaining broader redesign
- [ ] Finish unified workspace navigation and toolbar organization; preserve navigation already on the branch.
- [ ] Direct drawing input, snapping/constraint feedback, and in-project sketch/model editing.
- [ ] Further component, joinery, parametric, fabrication-layout, and Shop Mode improvements.

Status: implementation in progress; not release-ready. Checked items mean implemented, not runtime-verified.
