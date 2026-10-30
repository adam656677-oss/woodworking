# Shop Mode & Reference Tracing (Piece 3D) — Plan

Spec: docs/superpowers/specs/2026-10-29-shop-mode-tracing-design.md

1. Pure: src/shop/steps.ts (steps from a design: cut, joints, groups inside-out, final; from a plan; from a kids' project; progress ticks and minutes); src/shop/references.ts (add/update/remove, plane mapping, scale from two points in 3D and 2D).
2. Model: Reference type, Project.references, Project.shopProgress, Plan.progress, Sketch.reference; format 7 with checks.
3. Electron: keepAwake (power-save blocker) IPC.
4. UI: Shop Mode full-screen view (keys, ticks, zoom, timer, read aloud, exit); entries from the Master Shop toolbar, My Plans and kids' project pages; Pictures panel and References3D; drawing board Tracing picture.
5. Tests: unit, jsdom UI, e2e (Shop Mode on a bookshelf; 3D reference scaling; drawing board tracing) and screenshots.
