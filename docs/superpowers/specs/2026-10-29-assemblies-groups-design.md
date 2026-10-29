# Assemblies, Groups & Linked Copies — Design (Piece 3B)

Date: 2026-10-29
Status: decided by Claude under Adam's "run straight through" instruction (2026-10-29); Adam can redirect at any time
Builds on: Design Core (1), Drawing & Shapes (7A/7B), Sizes & Formulas (3A)

## 1. Purpose

Adam builds furniture the way a cabinet shop does: a carcass, a drawer, a door, each a unit he can move,
copy and hide. A drawer made once and copied as a **linked copy** stays the same everywhere: change one
drawer side's height and every drawer follows.

**Success:** select a drawer's five parts → Group → "Drawer". Linked copy ×2, stack them. Change the
first drawer's front width: all three fronts change, and the cut list shows 3 fronts. Hide the carcass to
see inside; Isolate one drawer; Show all.

## 2. Data (project format 5; v4 files open unchanged)

- `Project.groups?: Group[]`, `Group = { id, name, parentId?, link? }` — a tree. `link` is shared by groups
  that are linked copies of each other (each is an *instance*).
- `Board.groupId?` — the innermost group a part is in (none = loose part).
- `Board.link?` — key shared by the corresponding parts of linked instances.
- Damaged references in a file (missing parent, a board pointing to a missing group, a loop) are cleaned
  on open: the reference is dropped, the part stays.

## 3. Groups

- **Group** (toolbar, 2+ parts selected): asks a name (default "Assembly"). Groups that are wholly selected
  become sub-groups of the new group; other selected parts move into it. The new group sits inside the
  deepest group that holds the whole selection.
- **Ungroup**: its parts and sub-groups move up to its parent.
- **Parts list is a tree**: group rows (▸/▾, name, part count, eye) with their parts and sub-groups indented
  under them; loose parts at the end. Clicking a group selects all its parts; double-click renames.
- **A whole group selected** shows the Group panel: name, X/Y/Z (low corner of its box), overall size,
  Duplicate, Linked copy, Unlink, Ungroup. Typing X/Y/Z moves every part in it.
- **Rotate 90° with a whole group selected** turns the group as one unit about its centre (parts keep their
  places relative to each other). Mirror, Align, Duplicate and Delete already work on the selection.
- Deleting parts removes groups left empty.
- Kids' Simple Designer: no group controls; the parts list stays flat.

## 4. Linked copies

- **Linked copy** of a group: copies its parts, joints and sub-groups, placed beside it (to +X by its width +
  2"). The original and copy share a `link`; each pair of corresponding parts shares a `Board.link` key.
- **What stays in step** after every change: size (width, length, thickness), wood, grain, name, holes, end
  cuts, edge bevels, shape outline, turning, taper, edge profiles, and formulas for sizes (not X/Y/Z).
  Position and rotation are each instance's own.
- **Joints**: adding or removing a joint between two linked parts in one instance does the same in the
  others; changing a joint's settings changes the others'.
- **Unlink** makes an instance independent (its parts keep their current sizes).
- Cut list: linked parts are ordinary parts, so identical ones group together as today.

## 5. Hide and isolate

- An eye on each part and group row hides it in the 3D view (the list greys it). **Isolate** (toolbar) shows
  only the selection; **Show all** clears both. Not saved with the project; not an undo step.
- Hidden parts are still in the cut list and checks.

## 6. Testing

Unit: group/ungroup with nesting; group tree cleaning on open; empty groups pruned on delete; group move;
group rotate keeps relative layout; linked copy structure; size, wood, feature and formula propagation;
joint add/remove/setting propagation; unlink; v4 → v5 migration. UI: tree rendering, select-by-group,
rename, hide/isolate, Group panel.
E2E: group a drawer, linked copy twice, change one part's width, all follow; cut list count; hide/isolate.

## 7. Out of scope

Group names in formulas; nested linked instances with different link keys inside a linked instance beyond
what copying produces; assembly-sorted cut lists (Piece 5).
