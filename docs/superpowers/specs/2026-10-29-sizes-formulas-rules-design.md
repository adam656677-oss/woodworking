# Named Sizes, Formulas & Layout Rules — Design (Piece 3A)

Date: 2026-10-29
Status: approved in conversation (three sections), awaiting written-spec review
Builds on: Design Core (Piece 1), Drawing & Shapes (Pieces 7A, 7B)
Followed by: 3B assemblies & groups, 3C views & checks, 3D Shop Mode & tracing (Piece 3 split; order to be chosen)

## 1. Purpose

Adam designs like he does in CAD: name the sizes that matter (height, width, wood thickness), write
the rest as formulas, and keep parts placed by rules. Change one size and the whole piece follows —
parts, spacing and joinery. Unlocking a template no longer freezes it.

**Success:** Adam starts a bookshelf, unlocks it, changes `H` from 36 to 48 in the Sizes tab; the
sides lengthen, the shelves re-space evenly, the dados move with them and the cut list updates. He
types `=W/2` into a part's width and it follows `W`. A slat count of `=floor(W/4)` adds slats when the
bench gets wider.

### Said by Adam vs. assumed (all confirmed in conversation)

| Said by Adam | Assumed and confirmed |
|---|---|
| 3A = sizes & formulas first | Piece 3 split into 3A–3D |
| Formulas in any size box, with a Sizes panel | Inches; fractions in formulas; results to 1/64" |
| Rules: equal spacing, centered, fixed gap/flush, count from a formula | Joints follow parts moved/resized by formulas and rules |
| Unlock turns a template into named sizes, formulas and rules | Bad formulas keep the last good value; kids' Simple Designer has no formulas |
| Approach: formulas + an ordered recalculation pass (option 1) | Not a 3D constraint solver |

Constraints carried forward: Windows desktop, inches only, offline, everything tested; nothing ships
until all pieces are complete.

## 2. Named sizes and formulas

### 2.1 Sizes panel
- A **Sizes** tab beside Parts (Master Shop only). Each row: name, value or formula, result
  (`formatInches`). **Add size**; inline edit; delete.
- **Names:** start with a letter; letters, digits, `_`; case-insensitive; unique; not a built-in
  function name. Renaming updates every formula that uses it. Deleting a size still in use is refused:
  "H is used by: Side (Length), Back (Length)".
- **Built-in names** (read-only in formulas):
  - `<Part>.Width`, `<Part>.Length`, `<Part>.Thickness`, `<Part>.X`, `<Part>.Y`, `<Part>.Z` — the
    part's world box minimum for X/Y/Z. Parts are named by their name; duplicates get `#2`, `#3` in
    board order (`Shelf#2.Length`).
  - `Wood.<id>.T` / `.W` — a wood's thickness and width, e.g. `Wood.1x6.T`, `Wood.ply_3_4.T`
    (non-name characters become `_`).

### 2.2 Formula language
- Starts with `=` in a size box. A plain value (`11-3/4`, `1' 2"`) is an ordinary number.
- Allowed:
  - numbers and inch amounts: `3/4`, `11-3/4`, `11 3/4`, `1'`, `1' 2"`, `12"`
  - names, `+ - * /`, unary minus, brackets
  - `min`, `max`, `round`, `floor`, `ceil`, `abs`, `round8` (nearest 1/8"), `round16`
- A space between a whole number and a fraction means a mixed number (`11 3/4`); otherwise spaces are
  ignored.
- Errors (shown in red under the box; the field keeps its last good value):
  - "Unknown size 'Hight'"
  - "Can't read this formula near '…'"
  - "These sizes depend on each other: A → B → A"
  - "Width works out to -2" — it must be more than 0" (sizes; positions may be any value)
  - "Dividing by zero"
- **Display:** a box with a formula shows the result and a small *ƒ*; focusing it shows `=formula`;
  the tooltip shows the formula.
- **Typing a plain value over a formula** asks once: "Replace the formula =H - 2*T with 30"?" (Replace
  / Keep formula).

### 2.3 Where formulas work
- Board: width, length, X, Y, Z (positions are the world box minimum, as the boxes show today).
- Turning: top, bottom, biggest/smallest diameter. Taper: start, foot. Edge profile: size.
- Joints: dado/rabbet width, depth, offset.

### 2.4 Data
- `Project.sizes?: { name: string; expr: string }[]`
- `Board.formulas?: Partial<Record<'width'|'length'|'x'|'y'|'z'|'turning.top'|'turning.bottom'|'turning.maxD'|'turning.minD'|'taper.start'|'taper.foot', string>>`
  — and per edge profile `EdgeProfile.sizeExpr?`
- `Joint.formulas?: Partial<Record<'width'|'depth'|'offset', string>>`
- Values stay stored as numbers (the result of the last good recalculation), so every existing feature
  reads them unchanged.
- Project format **version 4**; version 3 files migrate unchanged.

## 3. Layout rules

`Project.rules?: Rule[]`, each `{ id, kind, ... }`, listed in a **Rules** section of the Sizes tab and on
each affected part (Properties → "Rules on this part", with remove buttons). Added from Properties →
**Add a rule** (and the parts list's right-click menu).

- **Equal spacing** `{ kind: 'spacing', axis: 'x'|'y'|'z', from: boardId, to: boardId, parts: boardId[] }`:
  - the parts sit between the inner faces of `from` and `to` along `axis`
  - equal clear gaps; each part's own thickness along that axis counts
- **Centered** `{ kind: 'center', axes: ('x'|'y'|'z')[], part, on }`: `part`'s centre equals `on`'s
  centre on each axis.
- **Fixed gap / flush** `{ kind: 'gap', axis, part, to, side: 'min'|'max', gap: number, gapExpr?: string }`:
  - `part`'s face sits `gap` from `to`'s face on that side (`max` = the far face, measured outward from
    `to`; `min` = the near face)
  - gap 0 = flush; the gap may be a formula
- **Count** `{ kind: 'count', expr: string, first: boardId, copies: boardId[], spacing: { axis, from, to } }`:
  - the run has `1 + copies.length` parts
  - the count's result (rounded, minimum 1, maximum 100) adds copies of `first` (same wood, sizes,
    formulas, features; joints to `from`/`to` repeated) or removes the last copies
  - the run is spaced as Equal spacing
- **Recalculation order** after every change:
  1. sizes
  2. board/joint formulas
  3. counts
  4. spacing / center / gap in the order added
  5. joints re-seat (§4)
  6. validate
- **Rules that disagree:** two rules placing the same part on the same axis. The later is skipped,
  listed with the warning "These rules disagree: <rule> and <rule> — remove one".
- **Moving or resizing a part that a rule or formula controls**, by drag, the move gizmo or typing: a
  confirm "This part is placed by a rule (Equal spacing). Remove the rule and move it?" (formula:
  "Replace the formula?").

## 4. Joints follow

After formulas and rules:
- each dado/rabbet re-derives its offset (and width, when not a formula) from its partner's box in the
  host's coordinates — the same way it was derived when added
- a partner's extension into the groove is kept: its length formula, or its stored extension, still
  applies
- joints that no longer meet get the existing "no longer lines up" warning; nothing else changes

## 5. Templates on Unlock

- Unlock converts a live template:
  - template settings → sizes
    - Bookshelf: `W`, `H`, `D`, `Shelves`, `T` (= the wood's thickness), `TB` (back thickness), plus
      helpers like `DadoDepth`
    - Box and Birdhouse likewise
  - each part's sizes/positions → formulas
  - repeated shelves → a count rule (`=Shelves + 2` levels between the Top and Bottom, equal spacing)
  - joints → joint formulas where they depend on sizes
- Each template supplies this "formula form" (`unlockForm(params, woods)`). The live template stays as
  it is.
- **Fidelity:** right after Unlock, the boards, joints and cut list equal the live template's (within
  1/64") for every template at several settings, including after changing a size to another valid
  value.
- Choice/boolean settings (e.g. back panel on/off) are fixed at Unlock: the parts they made are kept or
  not. Wood choice becomes the part's wood; `T` follows the wood (`=Wood.ply_3_4.T`).

## 6. Errors and edge cases

- **Damaged formulas or rules in a file** (unknown names, missing parts): the file opens; that formula
  or rule is shown in error and the stored values are used.
- **Recalculation never loops:** the dependency order is computed; loops are errors.
- **A rule pointing at a deleted part** is removed with that part (one undo step).
- **Undo:** each size, formula or rule change is one step; recalculation happens inside the same step.
- **Kids:** no Sizes tab and no formulas; projects with formulas still open in kids mode and show their
  values.

## 7. Testing

**Unit**
- Parser:
  - fractions, mixed numbers, feet, precedence, unary minus, functions
  - unknown names, syntax error positions, divide by zero
- Recalculation:
  - dependency order; loops reported
  - 1/64" rounding; size > 0 checks
  - built-in names, including duplicate names with `#n`
- Sizes:
  - renaming updates formulas
  - deleting a size in use is refused
- Rules:
  - spacing with parts of different thickness
  - centring on several axes
  - gap/flush on both sides
  - count adding and removing copies with their joints
  - conflicting rules skipped and warned
- Joints: a dado follows a shelf moved by a rule.
- Templates: Unlock fidelity (cut list and boards equal), then changing `H`/`W` matches a fresh live
  template at the new size, for Box, Bookshelf and Birdhouse.
- File: v3 → v4 migration; damaged formulas and rules open with errors.

**End-to-end (real app)**
1. Bookshelf → Unlock → change `H` 36 → 48 in the Sizes tab → sides 48", shelves re-spaced, dados
   followed, cut list updated.
2. Type `=W/2` into a part's width; change `W`; the part follows; typing a number asks to replace.
3. A slat count rule `=floor(W/4)`; change `W`; slats added.
4. A bad formula shows its message and keeps the last value.

## 8. Out of scope (3A)

Assemblies and linked copies (3B); exploded/section views, interference, weight, on-model dimensions
(3C); Shop Mode and photo tracing (3D); formulas in the drawing board (it has its own dimensions);
units other than inches.
