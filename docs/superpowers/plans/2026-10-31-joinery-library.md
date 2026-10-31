# Piece 10 — Joinery Library & Joint Designer (plan, as built)

Spec: docs/superpowers/specs/2026-10-29-joinery-library-design.md

- New joint type `joinery` (format v12) with `JoineryParams { style, depth, size, count, shoulder, slope, lap, through, haunch, biscuit, customId }`. Styles: half lap (cross lap by sinking the partner; corner/T lap by lengthening), dowels, biscuits (#0/#10/#20), loose tenons, box joint, through and half-blind dovetails (1:6 softwood / 1:8 hardwood, exact tails and pins), mortise and tenon (blind/through, shoulders, haunch note, 1/3 rule default, weak-cheek and thin-wall checks), bridle, tongue and groove, spline; Japanese: koshikake ari tsugi, kama tsugi, okkake daisen tsugi, kanawa tsugi, watari ago, hozo sashi, shachi sen; and designed joints.
- New contact kinds: edge-to-edge and end-to-end (in-line beams). `joineryOffers(contact)` lists styles per contact; the Joint panel has a "Cut joints" menu and per-style settings.
- Geometry is worked out from where the parts are now (src/joinery/cuts.ts): the partner lengthens into the host (restore records it; setting changes move it in/out; removing restores exactly) or sinks into it (restore `move`). Cuts: new local cut kinds `pocket` (box), `prism` (straight-sided outline along an axis — dovetails, splice profiles) and `bore` (round hole along any axis — dowels), drawn in 3D, counted in weight/interference/exports, used by `pointRemovedBy`.
- Shop notes per part (cut list and part sheets), Shop Mode step per joint, plain-language problems in the Joint panel and Warnings.
- Joint designer (src/joinery/voxel.ts, ui/JointDesigner.tsx; toolbar "Joint designer"): end-to-end or crossing beams on a 2–8 cell grid; click cells in 3D or on a layer grid; live feedback — slide directions, loose pieces, cuts a tool can't reach, thin necks (< 25% of section), short grain, contact area; presets; save to the project and use between parts.
- Drawers: new "Dovetails" box joint — half-blind at the front, through at the back.
- Library: Japanese tools (saws, chisels, planes, marking, water-stone sharpening) and a Japanese joinery article. Kids: joint pages (butt, lap, dowel, dado, rabbet, box) with strength bars.
- Not done: sampo zashi (needs three parts); Japanese joints are drawn from straight cuts; the kids' joint puzzle game belongs to Piece 9.
- Tests: tests/joinery/joinery.test.ts (volumes conserved per style, restore, settings, drawer), voxel.test.ts; tests/e2e/joinery.spec.ts.
