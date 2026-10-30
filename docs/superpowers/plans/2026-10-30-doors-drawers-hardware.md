# Doors, Drawers & Hardware (Piece 6) — Plan

Spec: docs/superpowers/specs/2026-10-29-doors-drawers-hardware-design.md

1. Model (format 8): edge grooves (GrooveParams face left/right) and stand-alone cuts; stopped holes (Hole.depth/face); Group.motion; Project.hardware / hardwareItems; contact 'endToEdge' for frame joints; validate/cut list/notes/reseat follow.
2. Pure: src/cabinet/{build,hardware,doors,drawers,faceFrame,shelfPins,motion}.ts — opening from selection, generators, hardware list and prices, shelf-pin layout, swing/slide transforms, clearance check.
3. Store: openAmount, cabinet dialog; hardware pruned with its parts; copies carry hardware and hinge lines.
4. UI: Cabinet ▾ menu and CabinetDialog (door, drawer, face frame, shelf pins); Hardware section in the cut list; Open doors & drawers slider; Checks → Door & drawer clearance; Scene swings/slides parts.
5. Tests: unit for every generator against hand sizes, validate + interference clean; jsdom UI; e2e (door + drawer → cut list, hardware, open, clearance).
