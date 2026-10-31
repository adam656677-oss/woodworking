# A&A Woodworking Studio — hand-off for the next coding agent

Last updated: 2026-10-31. Written by Claude (Opus) for whichever agent picks this up.

## 0. If you got this as a zip (no git)

The zip **A&A-Woodworking-Studio-code.zip** contains the whole project with Pieces 15 and 16 already combined into
it. The two merged cleanly, and all 738 unit tests pass. So you can skip the merge steps in §1 and §5: start with
the fixes in §3 and §4, then build (§5 step 3).

- Run `npm ci` first.
- To keep using git, run `git init`, then `git add -A`, then `git commit -m start`.

## 1. Where things stand

The roadmap is in `docs/superpowers/specs/2026-10-27-design-core-design.md` §2. It has 18 pieces, and the rule
is **release only when every piece is complete**.

- **Done, reviewed, fixed and merged** (on the main working branch `import-export`):
  - Pieces 1–14, 17 and 18.
  - That includes 8 (Realistic Rendering), 9 (Kids' Games), 10 (Joinery), 11 (Deep Library), 12 (Finishing
    School), 13 (Shop Tools) and 14 (Family & Sharing).
  - The last delivered installer (`_parts11`) contained everything up to Piece 9.
- **Piece 16 — Projects & Templates** (branch `projects`):
  - Built, and an independent review was done.
  - About two thirds of the review fixes are committed (`5a71c9c`). The rest is listed in §3.
- **Piece 15 — Smart Helpers** (branch `smart`):
  - Built and tested.
  - The independent review was started but cut off by a usage limit, so **it has not been reviewed**. See §4.
- **After those two:** merge both into `import-export`, run everything, build the installer, and deliver (§5).

### Branches

```
import-export   ← main working branch (has everything through Piece 14)
├── projects    ← Piece 16 (based on kids-games, which is already in import-export)
└── smart       ← Piece 15 (based on family = import-export at the time)
```

Both should merge into `import-export` cleanly except for small conflicts in:
- `src/ui/designer/Toolbar.tsx`
- `src/ui/designer/StartPanel.tsx`
- `src/ui/Home.tsx`
- `src/ui/App.tsx`
- possibly `src/templates/index.ts`

Keep **both** sides of each conflict.

## 2. How to work in this repo

- **Stack:** Electron, electron-vite, React 18, TypeScript (strict), Tailwind, zustand, three.js with
  react-three-fiber/drei, three-bvh-csg, Vitest, and Playwright (`_electron`) for end-to-end tests.
- **Commands:**
  - `npx tsc --noEmit -p .`
  - `npx vitest run`
  - `npm run build`
  - `xvfb-run -a npx playwright test` (Linux; e2e needs a build first)
  - `npm run dist` (Windows installer through electron-builder)
- **Clear the Vitest cache** (`node_modules/.vitest-cache`) after adding JSON content files, which are picked up
  by `import.meta.glob`.
- **Known false failures:** in a git worktree with a symlinked `node_modules`, 7 jsdom test files fail with
  "Denied ID" from the planegcs wasm. In the main checkout all tests pass. Last full run: 734 unit tests and 48
  e2e tests, all passing.
- **Units:** inches only. The design system uses plain words, no jargon, and every warning teaches something.
- **The kids' rule:** no streaks, points, currencies or guilt notifications. Badges come only from real built
  projects (confirmed by the parent) and passed quizzes.
- **How each piece was built:** a spec in `docs/superpowers/specs/`, a plan in `docs/superpowers/plans/`, test-first
  code, an independent review of the diff, a fix pass with tests, then delivery.
- **Delivering to Adam's computer:**
  1. Split the installer into 25 MB parts with `split -b 25m -d -a 2`.
  2. Copy the parts, `setup.sha256`, a `git archive` source zip and a `git bundle --all` into
     `~/OneDrive/Desktop/Woodworking/aa-woodworking-studio/_partsN/`. The next N is **12**.
  3. Reassemble the installer there.
  4. Check it with `sha256sum -c`.
  5. Move the old files and the parts folder into `_to_delete/`. Files can't be deleted on Adam's machine; he
     empties `_to_delete` himself.
  6. Name the copies `A&A Woodworking Studio Setup 0.1.0.exe`, `aa-woodworking-studio-source.zip` and
     `aa-woodworking-studio.bundle`.

## 3. Piece 16: review fixes still to do (branch `projects`)

The review is in this session's transcript. Here is a summary of what's left after commit `5a71c9c`.

### Already done in `5a71c9c`

- Step stool: the step is in front of the top, in dados, and height is capped at 1.6× depth.
- Cabinet:
  - a separate toe-kick base;
  - the back is inside the 23-1/4" depth;
  - the shelf rests on pins, with no joint, is 1/16" narrower than the inside and is set back 1";
  - shelf pins are in the hardware list.
- Side table: tabletop fasteners are in the hardware list (new item `tabletop-fastener`). Top boards are on the
  1/64" grid, with the last board taking the remainder, and Unlock matches.
- Wall shelf: shelf heights are snapped in both the build and the formulas, and `adjust` uses the rail's real
  width.
- Workbench:
  - the long rails lap over the leg faces and the short rails over the leg edges;
  - leg width comes from the frame wood;
  - the overhang is capped at `(W−12)/2` and `(D−12)/2`.
- Wood settings: a new `ParamDef.allow` (`kinds`/`minT`/`maxT`/`minW`/`maxW`) limits the woods offered in
  `TemplatePanel`. `applyTemplate` swaps a wood that isn't allowed for the default.
- Template hardware: `TemplateDef.build` can return `hardware`. Template-owned entries have ids starting with
  `tpl-` and are replaced on rebuild; Cabinet-menu hardware is kept.

### Still to do

1. **Make the generic template tests stronger** (`tests/templates/templates.test.ts`, "every template" block).
   - Run "no warnings" over the same variants as the unlock test: defaults, each bool flipped, each choice, and
     the min and max of every number.
   - Run "every joint matches a contact that offers it" over those variants too, for every template.
   - Compare unlock against build at `1e-6` instead of rounding to 1/64. Add mid-range cases such as table D=23
     with 3 boards, and wall shelf n=6 with H=21.
   - Add wood variants: every allowed wood for each wood setting.
   - Rename the out-of-date test "all three defaults have no warnings".
   - Add a test that `applyTemplate` replaces a wood that isn't allowed (e.g. table legs from `1x2`) with the
     default.
2. **Kids' project steps** (`src/kids/content/projects/*.json`). Each new step must use a tool from the project's
   tools list, and the tools must be within the project's level.
   - `planter.json`: add "Drill pilot holes 3/8 inch from the ends, so the screws don't split the wood" before the
     screw steps. Say "outdoor screws". Raise the bottom so water drains: in `src/kids/content/designs.ts`
     `planter()`, set the bottom at `z: 0.75` and keep the sides going to the ground.
   - `bookends.json`: say where the holes go ("3/8 inch from the end, in the middle"), countersink them, and drill a
     pilot hole up into the upright.
   - `phone-stand.json`: the same pilot-hole wording. Change the blurb to "phone", not "phone or tablet".
   - `coasters.json`: "Measure, mark and cut one square at a time" (each cut takes a saw-kerf).
   - Add a content test like the toolbox one: any project with a screwdriver step also has a drill step that
     mentions "pilot".
3. **Side table leg joint (optional).** It is still butt joints with screws. Better: offer mortise and tenon for a
   rail flush with the top of a leg (`src/joinery/plan.ts` `joineryOffers`, the `cornerEnds` case), or default to
   dowels. Optional.
4. **E2E** (`tests/e2e/projects.spec.ts`):
   - Open one new kids' project page and its printable sheet.
   - Start the side table and check that the hardware or shopping list shows "Tabletop fasteners".
5. **Spec** (`docs/superpowers/specs/2026-10-31-projects-templates-design.md`): update it for the step stool
   redesign, the cabinet base and the wood limits.
6. Commit, then (if possible) get an independent review of `kids-games..projects`.

## 4. Piece 15: Smart Helpers (branch `smart`), needs a review and fixes

- **Spec:** `docs/superpowers/specs/2026-10-31-smart-helpers-design.md`.
- **Plan:** `docs/superpowers/plans/2026-10-31-smart-helpers.md`.
- **Adam's decision:** he hasn't chosen yet. I told him that without an answer I'd build "option 2": built, but
  off until he adds his own Anthropic API key. That's what exists. The offline parts work without a key: the
  describe matcher, "trace instead", and hands-free Next.

### Files

- `src/smart/plan.ts`, `wood.ts`, `describe.ts`, `listen.ts`: pure checks, tested in `tests/smart/smart.test.ts`.
- `electron/ai.ts`: key storage with `safeStorage` (base64 in `ai-key.bin`), the request builder, JSON
  extraction and `ask`. Tested in `tests/electron/ai.test.ts`.
- IPC `smart:*` in `electron/main.ts`.
- **Test-only environment switches:** `AA_AI_URL` (a stand-in server) and `AA_TEST_PLAIN_KEY` (a plain key
  store, for Linux CI with no keyring).
- UI:
  - `src/smart/ui/SmartDialogs.tsx`: settings, Photo → plan, wood ID, Describe, and the build-steps panel.
  - `src/smart/ui/HandsFree.tsx`: in Shop Mode.
  - Entry points: Home, the Toolbar "✨ Helpers" menu, the StartPanel and the Library.
- **E2E:** `tests/e2e/smart.spec.ts` runs against a local stand-in server.

### A review should check

1. **Make sure the test-only switches can't be abused in the installed app.** They need to be ignored when
   `app.isPackaged`. Fix: in `main.ts`, use them only when `!app.isPackaged || process.env.AA_E2E`, and check how
   the e2e launches the app.
2. **The key must never reach the renderer or the logs.**
3. **Every answer path must treat the model's output as untrusted.** Paths: `checkPlan`, `checkWoodAnswer`,
   `checkDescribeAnswer`, then `applyTemplate`/`resolveParams`, then `planToProject`. Also cap the size of the
   response JSON.
4. **Orientation mapping:** in `plan.ts`, the `extent()` function must agree with `makeBoard`/`ORIENT`. Add a test
   that builds each `lies` value and compares `worldBox`.
5. **The offline matcher:**
   - sizes in words ("four shelves");
   - "2-1/2 ft";
   - check that each template's parameter keys map correctly for all 9 templates, once `projects` is merged.
6. **ClapDetector:** false triggers from hammering and from a saw starting or stopping. Shop Mode's keyboard handler
   must still work while listening.
7. **The anthropic-version header and the model id:** the default is `claude-sonnet-5-5` and can be changed in
   settings. Check this against current docs at docs.claude.com.

## 5. Finishing the release

1. Fix and review Pieces 16 and 15 (§3 and §4).
2. In the main checkout (`/home/claude/aa-woodworking-studio` here, or wherever the bundle is cloned):
   - `git merge projects`, then `git merge smart`. Resolve conflicts by keeping both sides.
   - Clear the Vitest cache, then run `npx vitest run`.
   - `npm run build`, then `xvfb-run -a npx playwright test`. Everything must pass.
3. `npm run dist` → `dist/A&A Woodworking Studio Setup 0.1.0.exe`. Consider bumping the version in
   `package.json` to 1.0.0 for the release.
4. Deliver (§2) and tell Adam:
   - what's in the release;
   - that Smart Helpers needs his API key in Home → ✨ Smart Helpers settings if he wants the online features.

## 6. Getting the code

- The latest bundle, with **all branches** including `projects` and `smart`, is
  `aa-woodworking-studio.bundle` in Adam's Woodworking\aa-woodworking-studio folder.
- To clone it: `git clone aa-woodworking-studio.bundle aa && cd aa && git checkout import-export`. The other
  branches are available as `git branch -a` / `git checkout projects`, etc.
- Then `npm ci`.
