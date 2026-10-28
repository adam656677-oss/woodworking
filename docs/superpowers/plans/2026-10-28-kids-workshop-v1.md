# Kids' Workshop v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Coming soon" kids' screen with the Kids' Workshop: a four-level path of lessons and quizzes, five printable starter projects built on the shared engine, a library, badges and certificates, a PIN-guarded parent area, and a Simple Designer.

**Architecture:** Lessons, quizzes, tools, library pages and project metadata are JSON files under `src/kids/content/`, loaded with `import.meta.glob`. Rules (quiz scoring, unlocking, tiers, badges) are pure functions in `src/kids/logic.ts`. Progress and the PIN live in the Electron main process (`electron/kidsStore.ts`) behind IPC; a zustand store (`src/kids/kidsStore.ts`) drives the kids' screens. The Simple Designer is the existing Designer in a `kidsMode`.

**Tech Stack:** Electron 45, React 18, TypeScript 7 strict, Tailwind 3, zustand 5, three / @react-three/fiber / drei, Vitest 5 (jsdom for UI), Playwright `_electron`.

**Spec:** `docs/superpowers/specs/2026-10-28-kids-workshop-v1-design.md`

## Global Constraints

- Inches only; no metric anywhere.
- No internet use; read-aloud uses `window.speechSynthesis` (Windows voices, offline).
- All illustrations are original inline SVG drawings in `src/kids/art/`; no copied text or images.
- Quiz pass: `correct >= Math.ceil(0.8 * total)` → 4/5, 5/6, 6/7, 7/8 (spec §3.3).
- Starting tier `'intermediate'`; tiers `'beginner' | 'intermediate' | 'advanced' | 'adult'`; `'adult'` is never selectable.
- Badges only from a passed level quiz or a parent-confirmed project; no streaks, points, timers, reminders or currency.
- PIN: exactly 4 digits; stored as PBKDF2-SHA256, 100,000 iterations, 16-byte random salt, in `kids-pin.json`.
- Progress in `<userData>/kids-progress.json` (formatVersion 1) via `safeSave`; photos in `<userData>/kids-photos/`, long side ≤ 1600 px.
- Simple Designer: sizes snap to 1/8"; butt joints only; woods `1x2,1x3,1x4,1x6,1x8,1x10,1x12,ply-1-2,ply-3-4`.
- Every starter project design must have `validate(design) === []`.

## Review Focus

1. A quiz with 8 questions where he gets exactly 6 right must fail (6 < 7); 7 must pass — pinned in Task 2.
2. Opening the kids' side with no progress file, a damaged one, or only a `.bak` — must start or recover without a crash — pinned in Task 3.
3. Wrong PIN, a PIN of letters, or "12345" must be refused and must not change tier or badges — pinned in Tasks 3 and 6.
4. A locked project must not print and must not be markable as built — pinned in Task 5.
5. Leaving the Simple Designer for the Master Shop must turn kids' limits off (all woods and joints back) — pinned in Task 8.

---

### Task 1: Content types, art registry, starter content and the content check

**Files:**
- Create: `src/kids/types.ts`, `src/kids/content/index.ts`, `src/kids/content/levels.json`, `src/kids/content/tools.json`, `src/kids/content/lessons/*.json`, `src/kids/content/quizzes/*.json`, `src/kids/content/library/*.json`, `src/kids/content/projects/*.json`, `src/kids/content/designs.ts`, `src/kids/art/index.tsx`
- Test: `tests/kids/content.test.ts`

**Interfaces:**
- Produces (`src/kids/types.ts`):
  - `type Tier = 'beginner' | 'intermediate' | 'advanced' | 'adult'`
  - `type Card = { image: string; text: string[]; tip?: { kind: 'try' | 'safety'; text: string } }`
  - `type Lesson = { id: string; title: string; level: number; cards: Card[] }` (library pages use `level: 0`)
  - `type Question = { prompt: string; choices: string[]; correct: number; reason: string }`
  - `type Quiz = { id: string; level: number; questions: Question[] }`
  - `type Tool = { id: string; name: string; tier: Tier; page?: string }`
  - `type Level = { id: number; name: string; lessons: string[]; quiz: string }`
  - `type KidProject = { id: string; name: string; level: number; stars: 1 | 2 | 3; minutes: number; kind: 'useful' | 'outdoors' | 'toy' | 'gift'; picture: string; tools: string[]; steps: { text: string; tool?: string }[] }`
- Produces (`src/kids/content/index.ts`): `LEVELS: Level[]`, `LESSONS: Record<string, Lesson>`, `QUIZZES: Record<string, Quiz>`, `TOOLS: Record<string, Tool>`, `LIBRARY: Lesson[]`, `PROJECTS: KidProject[]`, `designFor(projectId: string): Project`, `checkContent(): string[]` (list of problems; empty means good).
- Produces (`src/kids/art/index.tsx`): `ART: Record<string, () => JSX.Element>`, `Art({ name, className? })`.

Decision: project **designs** are written in `designs.ts` with the template helpers (`makeBoard`, `butt`, `ORIENT` from `src/templates/place.ts`) and `emptyProject`; metadata stays JSON. Hand-writing rotated boards as raw JSON is error-prone and the content check guards both.

Content to write (spec §5): levels 1–4 with names Sawdust Starter / Builder / Craftsman / Workshop Pro; the lessons listed in §5; quizzes of 8, 6, 6, 6 questions; tools per spec §4.1 table; library pages for each Beginner–Advanced tool plus `tree-to-board`, `pine`, `poplar`, `oak`, `plywood`.

Project designs (all from 1x lumber or `ply-1-2`, butt joints with glue/nails/screws):
- `pencil-holder` (L1, 1★, useful): 1x4 box, 4 sides 4" tall around a 3-1/2" square 1x4 bottom.
- `tic-tac-toe` (L1, 1★, toy): 1x10 base 9-1/4" square with four 1x2 grid strips glued on top.
- `birdhouse` (L2, 2★, outdoors): 1x6 front/back 8", sides 5-1/2" between them, floor, two roof boards; 1-1/4" entry hole in the front.
- `picture-frame` (L2, 2★, gift): 1x3 butt-jointed frame for a 5×7 photo (rails 10", stiles 7").
- `toolbox` (L3, 3★, useful): 1x6 sides 16", 1x6 ends 8" tall with a 1x2 handle between them, 1x6 bottom.

- [ ] **Step 1: Write the failing test** `tests/kids/content.test.ts`:
  - `checkContent()` returns `[]`.
  - `LEVELS.map(l => l.name)` equals `['Sawdust Starter', 'Builder', 'Craftsman', 'Workshop Pro']`.
  - quiz question counts per level equal `[8, 6, 6, 6]`; every quiz has `5 <= n <= 8`.
  - `PROJECTS.map(p => p.id)` equals `['pencil-holder', 'tic-tac-toe', 'birdhouse', 'picture-frame', 'toolbox']`.
  - for every project, `validate(designFor(p.id))` equals `[]` and every joint type is `'butt'`.
  - `TOOLS['table-saw'].tier === 'adult'`, `TOOLS['drill'].tier === 'intermediate'`, `TOOLS['hand-saw'].tier === 'beginner'`.
  - negative cases on `checkContentOf(content)` (the pure checker `checkContent` wraps): a question with `correct` out of range, a step tool `'chainsaw'`, a card image `'nope'`, a level whose quiz id is missing — each yields one problem string naming the item.
- [ ] **Step 2:** `npx vitest run tests/kids/content.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement types, art (one simple SVG per card image name used), content files, `designs.ts`, `index.ts` with `checkContentOf(c: Content): string[]` and `checkContent()`.
- [ ] **Step 4:** Run the test → PASS; `npx tsc --noEmit -p .` → no errors.
- [ ] **Step 5:** Commit `feat(kids): content model, starter content and content check`.

### Task 2: Rules — quiz scoring, shuffling, unlocking, tiers, badges

**Files:**
- Create: `src/kids/logic.ts`
- Test: `tests/kids/logic.test.ts`

**Interfaces:**
- Consumes: Task 1 types and content.
- Produces:
  - `type Progress = { formatVersion: 1; childName: string; tier: Exclude<Tier, 'adult'>; passedQuizzes: Record<string, string>; openedLessons: string[]; builtProjects: Record<string, { date: string; photo?: string }> }`
  - `newProgress(): Progress` (tier `'intermediate'`, name `''`)
  - `passMark(total: number): number` → `Math.ceil(0.8 * total)`
  - `scoreQuiz(answers: number[], quiz: Quiz): { correct: number; total: number; passed: boolean }`
  - `shuffleQuiz(quiz: Quiz, rand: () => number): Quiz` (questions and choices reordered; `correct` re-pointed)
  - `levelOpen(level: number, p: Progress): boolean` (level 1 always; level n when level n-1's quiz passed)
  - `projectUnlocked(proj: KidProject, p: Progress): boolean` (its level's quiz passed)
  - `adultDoes(toolId: string | undefined, tier: Tier): boolean` (tool tier rank > child tier rank; `'adult'` tools always true; undefined → false)
  - `badges(p: Progress): { kind: 'level' | 'project'; id: string; name: string; date: string }[]`
  - `TIER_RANK: Record<Tier, number>` = beginner 0, intermediate 1, advanced 2, adult 3

- [ ] **Step 1: Write the failing tests:**
  - `passMark(5..8)` equals `[4, 5, 6, 7]`; `scoreQuiz` with 6 of 8 → `passed: false`; 7 of 8 → `passed: true`.
  - `shuffleQuiz` with a seeded `rand`: same multiset of prompts; for each question, `choices[correct]` equals the original right answer text.
  - `levelOpen(1, newProgress())` true, `levelOpen(2, newProgress())` false, true after `passedQuizzes['quiz-1']` is set.
  - `projectUnlocked(pencilHolder, newProgress())` false → true after level-1 quiz passed.
  - `adultDoes('jigsaw', 'intermediate')` false; `adultDoes('jigsaw', 'beginner')` true; `adultDoes('table-saw', 'advanced')` true; `adultDoes(undefined, 'beginner')` false.
  - `badges` lists a level badge per passed quiz and a project badge only for `builtProjects`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `src/kids/logic.ts`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(kids): quiz, unlock, tier and badge rules`.

### Task 3: Progress, PIN and photos in the main process

**Files:**
- Create: `electron/kidsStore.ts`
- Modify: `electron/main.ts` (IPC), `electron/preload.ts`, `src/ui/aa-api.d.ts`
- Test: `tests/electron/kidsStore.test.ts`

**Interfaces:**
- Consumes: `safeSave` from `electron/fileStore.ts`; `Progress`, `newProgress` from Task 2.
- Produces (`electron/kidsStore.ts`, each takes the data dir):
  - `loadProgress(dir: string): Promise<{ progress: Progress; notice: string | null }>` — missing file → fresh, notice null; damaged file → `.bak` if valid (notice `"Progress was restored from the backup copy."`), else fresh (notice `"Progress couldn't be read and was started fresh."`).
  - `saveProgress(dir: string, p: Progress): Promise<void>` (safeSave)
  - `pinIsSet(dir): Promise<boolean>`, `setPin(dir, pin: string): Promise<void>` (throws `'PIN must be 4 digits'` unless `/^\d{4}$/`), `checkPin(dir, pin: string): Promise<boolean>`
  - `pinFilePath(dir): string`
- IPC / `window.aa` additions: `kidsLoad(): Promise<{progress, notice}>`, `kidsSave(p)`, `kidsPinIsSet()`, `kidsSetPin(pin)`, `kidsCheckPin(pin)`, `kidsPinPath(): Promise<string>`, `kidsAddPhoto(projectId): Promise<string | null>` (file dialog; `nativeImage` resize to long side ≤ 1600; saved as `kids-photos/<projectId>.jpg`; returns file name), `kidsPhotoUrl(name): Promise<string | null>` (data URL).
- `kidsSetPin` and the tier/confirm IPCs never accept a change without the PIN check happening in the renderer flow first; `kidsSave` validates shape (same checks as load) and refuses `tier: 'adult'`.

- [ ] **Step 1: Write the failing tests** (temp dirs):
  - load with no file → `newProgress()`, notice null.
  - save then load round-trips.
  - damaged main file with good `.bak` → `.bak` contents and the restored notice; both damaged → fresh and the started-fresh notice.
  - `setPin(dir, '1234')` then `checkPin('1234')` true, `checkPin('4321')` false; the PIN file does not contain `'1234'`.
  - `setPin(dir, 'abcd')` and `setPin(dir, '12345')` reject with `'PIN must be 4 digits'`.
  - deleting the PIN file → `pinIsSet` false and progress unchanged.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement with `node:crypto` `pbkdf2` (sha256, 100000, 32-byte key) and `timingSafeEqual`; wire IPC.
- [ ] **Step 4:** Run → PASS; typecheck clean.
- [ ] **Step 5:** Commit `feat(kids): progress, PIN and photo storage`.

### Task 4: Kids store, home screen and navigation

**Files:**
- Create: `src/kids/kidsStore.ts`, `src/kids/ui/KidsHome.tsx`, `src/kids/ui/KidsShell.tsx`, `src/kids/ui/ReadAloud.tsx`, `src/kids/speech.ts`
- Modify: `src/ui/App.tsx` (render `KidsShell` for screen `'kids'`); delete `src/ui/KidsPlaceholder.tsx`
- Test: `tests/kids/kidsStore.test.ts`

**Interfaces:**
- Produces `kidsStore` (zustand) with state `{ loaded, progress, notice, page }` where
  `page = { name: 'home' } | { name: 'path' } | { name: 'lesson'; id: string; card: number } | { name: 'quiz'; id: string } | { name: 'projects' } | { name: 'project'; id: string } | { name: 'learn' } | { name: 'badges' } | { name: 'parent' } | { name: 'sheet'; id: string } | { name: 'certificate'; badgeId: string }`;
  actions `load()`, `go(page)`, `openLesson(id)`, `markLessonOpened(id)`, `passQuiz(quizId)`, `confirmBuilt(projectId, pin): Promise<boolean>`, `setTier(tier, pin): Promise<boolean>`, `resetQuiz(quizId, pin): Promise<boolean>`, `setNameAndPin(name, pin): Promise<void>`. Every change calls `window.aa.kidsSave`.
- `speech.ts`: `hasVoice(): boolean`, `speak(text: string): void`, `stop(): void`, `isSpeaking(): boolean`.
- `ReadAloud({ text })`: speaker button, toggles speak/stop; renders nothing when `!hasVoice()`.
- `KidsHome`: five tiles (`My Path`, `Projects`, `Learn`, `My Badges`, `Simple Designer`), gear button `aria-label="Parent"`, a Back to home button.

- [ ] **Step 1: Write failing tests** with a fake `window.aa`: `confirmBuilt('pencil-holder', '0000')` with a wrong PIN returns false and leaves `builtProjects` empty; with the right PIN and level 1 passed it records the project and calls `kidsSave`; `confirmBuilt` on a locked project returns false; `setTier('advanced', right)` updates tier; `passQuiz('quiz-1')` records a date and saves.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement store, speech, ReadAloud, KidsHome, KidsShell (switches on `page.name`; pages from later tasks render a "loading" stub until their task lands).
- [ ] **Step 4:** Run → PASS; existing Kids e2e test 5 updated to expect the five tiles.
- [ ] **Step 5:** Commit `feat(kids): kids store, home and read-aloud`.

### Task 5: Path, lessons, quizzes, projects, library and badges screens

**Files:**
- Create: `src/kids/ui/PathView.tsx`, `LessonView.tsx`, `QuizView.tsx`, `ProjectsView.tsx`, `ProjectPage.tsx`, `LearnView.tsx`, `BadgesView.tsx`, `src/kids/ui/ProjectViewer.tsx`
- Test: `tests/kids/screens.test.tsx` (jsdom; `ProjectViewer` mocked)

**Interfaces:**
- Consumes: Tasks 1, 2, 4.
- `ProjectViewer({ project, onSnapshot? })`: read-only R3F canvas reusing `BoardMesh` and `cutGeometry`, OrbitControls, `preserveDrawingBuffer: true`; `onSnapshot(dataUrl)` called once after first render frames.
- `ProjectPage` shows tools (with tier), steps with "Adult does this" when `adultDoes(step.tool, tier)`, the cut sheet (`cutList(designFor(id))`), and buttons `Print project sheet` and `Mark as built`, both disabled with text "Pass the Level N quiz to unlock" when locked.
- `QuizView`: one question at a time, reason shown after each answer, result screen with Retry (reshuffled via `shuffleQuiz(quiz, Math.random)`) or "You passed!" → `passQuiz`.
- `LessonView`: one card at a time, Back/Next, ReadAloud per card, `markLessonOpened` on the last card.

- [ ] **Step 1: Write failing tests:**
  - PathView shows Level 2 locked on a fresh progress and open after `quiz-1` passed.
  - QuizView: answering 7 of 8 right shows "You passed!" and records the quiz; 6 of 8 shows "Try again" and records nothing.
  - ProjectPage for `pencil-holder` on fresh progress: `Print project sheet` and `Mark as built` disabled; after quiz-1 passed, enabled.
  - ProjectPage for `toolbox` with tier `beginner` marks the drill step "Adult does this"; with `intermediate` it does not.
  - LessonView reaching the last card marks the lesson opened.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement the screens (big type, sky/amber kids palette, large buttons).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(kids): path, lessons, quizzes, projects, library and badges`.

### Task 6: Parent area

**Files:**
- Create: `src/kids/ui/ParentArea.tsx`, `src/kids/ui/PinPrompt.tsx`
- Test: `tests/kids/parent.test.tsx`

**Interfaces:**
- `PinPrompt({ title, onSubmit(pin): Promise<boolean>, onCancel })`: 4-digit field (`inputMode="numeric"`, `maxLength={4}`), shows "That PIN isn't right" on false.
- `ParentArea`: if `!pinIsSet` → setup form (child's first name + PIN + confirm PIN, must match and be 4 digits). Else PIN prompt, then: tier radio (Beginner / Intermediate / Advanced), list of unlocked unbuilt projects with `Mark as built` and `Add photo`, `Reset` per passed quiz, change name/PIN, and "Forgot PIN?" text naming `kids-pin.json` and the folder path from `kidsPinPath()`; shows `notice` from load if any.

- [ ] **Step 1: Write failing tests:** setup refuses mismatched PINs and `'12a4'`; wrong PIN shows the error and does not reveal settings; right PIN reveals the tier choice and changing it calls `setTier`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(kids): parent area with PIN`.

### Task 7: Project sheet and certificate printing

**Files:**
- Create: `src/kids/ui/ProjectSheet.tsx`, `src/kids/ui/Certificate.tsx`
- Modify: `src/ui/index.css` (`.print-portrait` / `.print-landscape` page rules)
- Test: `tests/kids/print.test.tsx`

**Interfaces:**
- `ProjectSheet({ projectId })` (portrait, `print-area print-portrait`): name, stars, minutes, tools with tier and "Adult does this", the snapshot image from `ProjectViewer.onSnapshot`, numbered steps each with a check box, cut-list table (Qty, Part, Thickness, Width, Length, Wood), lines "Time spent: ____" and "Cost: ____", and a "Glue your photo here" box; Print and Back buttons hidden in print.
- `Certificate({ badgeId })` (landscape, `print-area print-landscape`): "Certificate of Achievement", child's name, badge name, date earned (long US format), "Signed: ____".
- CSS: `@page` size chosen by a `data-print` attribute on `<html>` set before `window.aa.print()` (`portrait` or `landscape`), defaulting to landscape (cut list).

- [ ] **Step 1: Write failing tests:** ProjectSheet for `birdhouse` lists every cut-list row from `cutList(designFor('birdhouse'))` with `formatInches` sizes, 6 check boxes per 6 steps (one per step), and the "Glue your photo here" box; Certificate shows the child's name and `October 28, 2026` for date `2026-10-28`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(kids): printable project sheet and certificate`.

### Task 8: Simple Designer (kids mode of the designer)

**Files:**
- Modify: `src/ui/store.ts` (`kidsMode: boolean`, `enterKidsDesigner()`; `goto('master')` from Home clears it), `src/ui/designer/Designer.tsx`, `Toolbar.tsx`, `PropertiesPanel.tsx`, `JointPanel.tsx`, `WarningsList.tsx`, `src/ui/three/MoveGizmo.tsx`, `src/ui/Home.tsx`
- Create: `src/kids/kidWords.ts`
- Test: `tests/kids/simpleDesigner.test.ts`, extend `tests/ui/store.test.ts`

**Interfaces:**
- `KID_WOODS = ['1x2','1x3','1x4','1x6','1x8','1x10','1x12','ply-1-2','ply-3-4']`
- `round8(n: number): number` → nearest 1/8, minimum 1/8.
- `kidMessage(w: Warning, project: Project): string` — overlap: `"<A> and <B> are bumping into each other — move one"`; too long: `"<A> is longer than the board you'd buy (<len>) — make it shorter or pick a longer board"`; too wide: `"<A> is wider than a <wood> — make it narrower or pick a wider board"`; anything else: the original message.
- In kids mode: Toolbar shows only Home (→ kids screen), New blank, Open, Save, Save As, Add board, Duplicate, Delete, Rotate 90°, Undo, Redo, Cut list, Print; wood select limited to `KID_WOODS`; width/length/position inputs pass through `round8`; gizmo grid 1/8"; JointPanel offers only butt; warnings use `kidMessage`; no templates panel.

- [ ] **Step 1: Write failing tests:** `round8(3.3)` → 3.25, `round8(0.01)` → 0.125; `kidMessage` for an exceedsStock length warning on a 1x4 → the long-board sentence; store: `enterKidsDesigner()` sets `kidsMode` and screen `'master'` with a blank project; `goto('master')` via Home's Master Shop path clears `kidsMode`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS; full `npx vitest run` green.
- [ ] **Step 5:** Commit `feat(kids): Simple Designer`.

### Task 9: End-to-end flows, installer, delivery

**Files:**
- Modify: `tests/e2e/designer.spec.ts` (test 5), create `tests/e2e/kids.spec.ts`

- [ ] **Step 1: Write e2e tests** (fresh dirs via `AA_USER_DATA`):
  1. Parent setup (name "Sam", PIN 1234) → My Path → Level 1 quiz answered all right → "You passed!" → Projects shows Pencil holder unlocked and Level 2 open on My Path.
  2. Pencil holder → Print project sheet → sheet shows the cut-list rows and a photo box (print stubbed in main via `app.evaluate`).
  3. Mark as built with wrong PIN 9999 → refused; with 1234 → My Badges shows "Pencil holder"; certificate shows "Sam".
  4. Simple Designer: add two boards, set them to 1x4 × 12" and 1x4 × 10-1/8" (typed `10.1` rounds to `10-1/8"`); cut list shows both rows; Home returns to the Kids' Workshop.
- [ ] **Step 2:** `npm run build && xvfb-run -a npx playwright test` → all pass.
- [ ] **Step 3:** Full unit suite and typecheck clean.
- [ ] **Step 4:** Final review (one reviewer), one fix pass.
- [ ] **Step 5:** `WINEDEBUG=-all xvfb-run -a npm run dist`; commit; deliver installer (split ≤ 25 MB, rejoined and checksum-verified) and source to `Woodworking\aa-woodworking-studio`.
