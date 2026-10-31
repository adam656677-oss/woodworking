# Piece 16 (first batch) — plan

Spec: docs/superpowers/specs/2026-10-31-projects-templates-design.md

1. src/templates/table.ts and src/templates/more.ts (workbench, cabinet, cuttingBoard, stepStool, wallShelf): build +
   unlockForm (+ adjust where sizes depend on the wood); `glued()` helper in place.ts (host from the contact).
2. src/model/contact.ts: edge/edge and end/end host by position, not argument order.
3. Generic template tests (no warnings, joints offered, unlock = build) over every option and number extreme.
4. Kids: art (coasters, bookends, planter, phone-stand), designs, project JSON files; content tests.
5. StartPanel wraps; e2e tests/e2e/projects.spec.ts.
