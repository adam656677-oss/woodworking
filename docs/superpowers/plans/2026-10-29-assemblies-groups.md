# Assemblies, Groups & Linked Copies (Piece 3B) — Plan

Spec: docs/superpowers/specs/2026-10-29-assemblies-groups-design.md

1. Model: `Group`, `Board.groupId`, `Board.link`, `Project.groups`; format 5 with migration and group checks; cleaning of damaged references on open (`pruneGroups`).
2. `src/assemblies/ops.ts`: ancestry/subgroups/groupBoardIds/wholeGroup/groupBox; groupBoards, ungroup, renameGroup, moveGroup, rotateGroup; copyGroup (plain and linked, numbered), unlinkGroup; syncLinks (sizes, features, size formulas, single-part moves, deletions, joints).
3. Store: apply runs keepNudges/releaseEdited → syncLinks → pruneGroups → recalc; hidden/isolated view state with setHidden/isolate/showAll; 3D view shows only visible parts.
4. UI: parts tree (group rows: open/close, select, rename, eye; board eyes; flat in kids mode); toolbar Group (name dialog), Ungroup, Isolate, Show all; Rotate turns a whole group as one; Group panel (name, size, Group X/Y/Z, Duplicate group, Linked copy, Unlink, Ungroup).
5. Tests: unit (ops, files, store), UI (jsdom), e2e (group, linked copies, hide/isolate) and screenshots.
