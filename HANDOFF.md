# A&A Woodworking Studio — hand-off for the next coding agent

Last updated: 2026-10-31. Written by Claude (Opus) for whichever agent picks this up.

## 0. If you got this as a zip (no git)

`aa-woodworking-studio-source.zip` is the finished 1.0.0 code. Run `npm ci` first. To keep using git, run
`git init`, `git add -A`, `git commit -m start`.

## 1. Where things stand

**The roadmap is complete.** All 18 pieces are built, independently reviewed, fixed and merged on `import-export`,
released as version 1.0.0 (installer delivered in `_parts12`). Last full run: 781 unit tests and 52 e2e tests, all
passing.

- Piece 15 (Smart Helpers) is "option 2": built, and off until an Anthropic API key is entered in Home → ✨ Smart
  Helpers settings. The offline parts (describe matcher, trace a photo, double-clap "next") work without a key.
- Optional idea left over: offer mortise and tenon for the side table's leg-to-apron joints (now butt joints with
  screws), in `src/joinery/plan.ts` `joineryOffers`, the `cornerEnds` case.

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
     `~/OneDrive/Desktop/Woodworking/aa-woodworking-studio/_partsN/`. The next N is **13**.
  3. Reassemble the installer there.
  4. Check it with `sha256sum -c`.
  5. Move the old files and the parts folder into `_to_delete/`. Files can't be deleted on Adam's machine; he
     empties `_to_delete` himself.
  6. Name the copies `A&A Woodworking Studio Setup 1.0.0.exe`, `aa-woodworking-studio-source.zip` and
     `aa-woodworking-studio.bundle`.

## 3. Getting the code

- The latest bundle, with **all branches** including `projects` and `smart`, is
  `aa-woodworking-studio.bundle` in Adam's Woodworking\aa-woodworking-studio folder.
- To clone it: `git clone aa-woodworking-studio.bundle aa && cd aa && git checkout import-export`. The other
  branches are available as `git branch -a` / `git checkout projects`, etc.
- Then `npm ci`.
