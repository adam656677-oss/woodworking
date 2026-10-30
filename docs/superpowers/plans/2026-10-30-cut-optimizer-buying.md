# Cut Optimizer & Buying (Piece 4, with edge banding) — Plan

Spec: docs/superpowers/specs/2026-10-29-cut-optimizer-buying-design.md

1. Model (format 10): Board.banding, Project.cutSettings, Wood.pricePerPiece, Group.oneSheet; cut-list rows carry their part ids and cut size.
2. Pure: src/optimize/{banding,settings,pieces,layout,shopping,labels}.ts — banding cut size and notes; per-material kerf/trims/allowance; pieces with P-numbers and grain lock; guillotine strip packing (several orderings, fewest sheets, then waste, then rip widths) with shop stock first and defects; lumber rip + crosscut with length choice; rough hardwood by random-width boards with glue-ups; shopping list with banding, hardware, tax; Avery 5160/5163 labels with QR (qrcode-generator, verified by jsQR).
3. Shop stock (app data folder) via IPC and a store; Mark as used keeps the biggest offcut.
4. UI: Cut List window tabs (Cut list, Layout, Buy, Labels); Edge banding section in Properties; banding strips in 3D; "Cut from one sheet" on groups.
5. Tests: packing cases, lumber, stock and defects, shopping, banding, labels + QR decode, jsdom tabs, e2e bookshelf layout/buy/labels.
