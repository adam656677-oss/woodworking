# Kids' Workshop v1 — Design (Piece 2)

Date: 2026-10-28
Status: approved in conversation, awaiting written-spec review
Builds on: Design Core (Piece 1), `docs/superpowers/specs/2026-10-27-design-core-design.md`

## 1. Purpose and who it is for

The Kids' Workshop is the son's side of A&A Woodworking Studio. He is 8, reads well
for his age, and already uses hand tools, a cordless drill/driver and small power
tools (jigsaw, random-orbit sander, scroll saw) with his dad. He will use the app
partly on his own (lessons, quizzes, library, simple designer) and partly with his
dad (anything that happens in the shop).

**Success:** on his own, he can work through a level's lessons, pass its quiz, pick
an unlocked project and print its sheet. They build it together, Adam confirms with
his PIN, and the badge and a printable certificate appear.

Constraints carried from Piece 1: Windows desktop, inches only, no internet needed,
nothing ships until all pieces are complete.

### What Adam said vs. what was assumed (all confirmed in conversation)

| Said by Adam | Assumed and confirmed |
|---|---|
| Mix of solo and together use | A 4-digit parent PIN guards tool tier, project confirmation and settings |
| Reads well for his age | Read-aloud is a button on every card, not automatic |
| Uses hand tools, drill/driver, small power tools | Starting tier is Intermediate |
| Wants all four project kinds | Five starter projects: pencil holder, tic-tac-toe board, birdhouse, picture frame, small toolbox |
| — | One kid profile in v1; multiple kids and the parent dashboard are Piece 14 |

## 2. Approach

**Content as data on the shared engine.** Lessons, quizzes, projects and library
pages are data files bundled with the app. The kids' screens render them. Project
designs use the Design Core's `Project` model, so the 3D view, cut list and printing
come from the same engine as the Master Shop. Adding a lesson or project later
(Piece 16) means adding a data file, not code.

Rejected: hand-built screens per lesson (does not scale to the planned content);
a separate kids' app (breaks the one-shared-engine decision).

## 3. Screens

The Kids' Workshop home replaces the current "Coming soon" screen. It has five tiles
and a small parent gear icon.

### 3.1 My Path
The four levels drawn as a trail map. Level names:

1. Sawdust Starter
2. Builder
3. Craftsman
4. Workshop Pro

Each level lists its lessons (tick when opened to the last card) and ends with its
quiz. Level 1 is open from the start. A level opens when the previous level's quiz
is passed. A level's projects unlock when that level's quiz is passed.

### 3.2 Lessons
A lesson is a short run of cards, one card on screen at a time, with Back / Next.
Each card: an original illustration, two or three short sentences, optional
"Try it" or "Safety tip" box, and a speaker button for read-aloud.

### 3.3 Quiz
- 5–8 multiple-choice questions per level.
- Passing score: 80% or better (rounded down to whole questions: 4 of 5, 5 of 6,
  6 of 7, 7 of 8).
- After each answer: a wrong answer shows the right one and a one-line reason;
  a right answer shows the reason too.
- Retry is allowed immediately; each attempt shuffles question order and answer
  order.
- Passing a level quiz earns that level's badge.

### 3.4 Projects
A card per project: name, picture, difficulty stars (1–3), time estimate, and a
lock icon when its level's quiz is not yet passed (a locked project can be looked
at but not printed). Opening a project shows:

- the 3D model (shared viewer, rotate and zoom only),
- tools needed, each with its tier,
- numbered steps; a step whose tool is above his tier is marked **"Adult does this"**
  (the step is still shown),
- the cut sheet (shared cut list),
- **Print project sheet** and, for the parent, **Mark as built** (PIN).

### 3.5 Learn (library)
Always open, no level gates: tool pages, wood pages ("tree to board", pine, poplar,
oak, plywood), first aid basics. Each page is a lesson-style card run with read-aloud.

### 3.6 My Badges
Earned badges (level badges and project badges), each with **Print certificate**.
Each confirmed project has a photo spot: the parent can add one photo (JPG or PNG,
copied into the app's settings folder, shrunk to at most 1600 px on the long side).

### 3.7 Simple Designer
The Design Core designer with a reduced toolbar:

- Add board, move, rotate 90°, duplicate, delete, undo/redo, cut list, print.
- Sizes snap to 1/8" (typed sizes round to the nearest 1/8").
- Butt joints only (glue, screws or nails).
- Woods limited to the built-in dimensional lumber (1x2 through 1x12) and 1/2",
  3/4" plywood.
- Warnings use kid wording (for example "This board is longer than an 8-foot
  board — make it shorter or pick a longer board").
- Saves and opens the same `.aaw` files as the Master Shop.

### 3.8 Parent area (gear icon → PIN)
- First visit: set a 4-digit PIN and the child's first name (used on certificates).
- Set tool tier: Beginner / Intermediate / Advanced.
- Confirm a project as built (also reachable from the project page).
- Reset a level's quiz result.
- Change PIN or name.
- "Forgot PIN" shows: delete the file `kids-pin.json` in the app's settings folder
  (path shown) to set a new PIN. Progress is kept.

## 4. Rules

### 4.1 Tool tiers
Each tool has one tier. A step is "Adult does this" when the step's tool tier is
higher than the child's tier.

| Tier | Tools |
|---|---|
| Beginner | tape measure, square, pencil, hand saw + miter box, hammer, clamps, sandpaper/sanding block, glue, screwdriver |
| Intermediate | cordless drill/driver, jigsaw, scroll saw, random-orbit sander |
| Advanced | brad nailer, block plane, Dremel-style rotary tool |
| Adult only (never unlocked in Kids') | table saw, miter saw, router, lathe, band saw, planer |

Starting tier is Intermediate. Tier never changes without the PIN.

### 4.2 Badges
- **Level badge:** earned by passing that level's quiz.
- **Project badge:** earned only when the parent confirms the project was built
  (PIN). Printing or opening a project earns nothing.
- No streaks, points, timers, reminders or virtual currency.

## 5. Content for v1

All illustrations are original simple drawings made for the app. No copied text or
images.

**Level 1 — Sawdust Starter**
Lessons: shop rules; safety gear (glasses, hearing, dust mask); first aid basics;
measuring and the tape measure (reading to 1/8"); hand saw and miter box; hammer and
nails; sandpaper grits. Quiz: 8 questions.
Projects: pencil holder (1 star); tic-tac-toe board (1 star).

**Level 2 — Builder**
Lessons: drill/driver; screws vs. nails; clamps and glue; squares and marking.
Quiz: 6 questions.
Projects: birdhouse (2 stars); picture frame (2 stars, butt-jointed corners).

**Level 3 — Craftsman**
Lessons: jigsaw; scroll saw; random-orbit sander; kid-safe finishes (links to
Finishing School in Piece 12 when it exists). Quiz: 6 questions.
Project: small toolbox with handle (3 stars).

**Level 4 — Workshop Pro**
Lessons: what the table saw, miter saw, router and lathe do and why an adult runs
them; dust and noise. Quiz: 6 questions. Projects arrive in Piece 16.

**Library pages:** each tool in §4.1 (Beginner–Advanced), "tree to board", pine,
poplar, oak, plywood.

Exact project dimensions are set in the implementation plan, sized to standard
dimensional lumber and checked by the content test (§8).

## 6. Data

### 6.1 Content files (bundled, read-only) — `src/kids/content/`
- `levels.json` — level id, name, order, lesson ids, quiz id.
- `lessons/<id>.json` — `{ id, title, level, cards: [{ image, text[], tip?: { kind: 'try' | 'safety', text } }] }`
- `quizzes/<id>.json` — `{ id, level, questions: [{ prompt, choices[], correct, reason }] }`
- `projects/<id>.json` — `{ id, name, level, stars, minutes, kind, tools: toolId[], steps: [{ text, tool? }], design: Project }`
- `tools.json` — `{ id, name, tier, page }`
- `library/<id>.json` — same shape as a lesson.

### 6.2 Progress (per computer) — in the app's settings folder
- `kids-progress.json` — `{ formatVersion, childName, tier, passedQuizzes: { [quizId]: dateISO }, openedLessons: id[], builtProjects: { [projectId]: { date, photo? } } }`
- `kids-pin.json` — `{ salt, hash }` (PBKDF2-SHA256, 100,000 iterations). The PIN is
  never stored as plain text.
- Photos in `kids-photos/`.
- Written with the Piece 1 safe save (temp file, `.bak`, rename with retry).

## 7. Printing and read-aloud

**Project sheet** (letter, portrait, existing print path): name and stars; time
estimate; tools with tier and "Adult does this" marks; a 3D picture of the finished
project; numbered steps with check-off boxes; cut sheet; lines for time spent and
cost; a "glue your photo here" box.

**Certificate** (letter, landscape): child's name, badge name and picture, date
earned, a line for the parent's signature.

**Read-aloud:** Windows' built-in speech voice through the browser speech API; works
offline. Reads the current card only; pressing the button again stops it. If no
voice is available, the speaker button is hidden.

## 8. Errors and edge cases

- **Progress file damaged or missing:** load the `.bak` if it is good; otherwise
  start fresh and show a plain message on the parent screen. Never crash.
- **PIN file missing:** treated as "no PIN yet"; the gear icon asks to set one.
  Progress is untouched.
- **Content problems** (a quiz with no correct answer, a project design with
  warnings, a step naming an unknown tool, a level with no quiz, a lesson id that
  does not exist): caught by the automatic content test before release, so they
  never reach the child.
- **Photo too large or unreadable:** shrunk if large; a plain message if unreadable.
- **No speech voice:** speaker buttons hidden.

## 9. Testing

**Unit tests**
- Quiz scoring and the 80% pass rule for 5–8 questions; shuffling keeps the right
  answer attached to its question.
- Tier logic: "Adult does this" marks for each tier.
- Level and project unlocking from progress.
- Badge rules (level badge on quiz pass; project badge only on parent confirm).
- PIN hash and check; wrong PIN rejected.
- Progress save/load, `.bak` fallback, fresh start on damage.
- Simple Designer: 1/8" snapping, butt-only joints, limited woods.

**Content test** — every content file is checked: schemas valid; every quiz has
exactly one correct answer per question; every project design passes `validate()`
with no warnings; every step tool exists; every level has a quiz; every referenced
lesson and image exists.

**End-to-end (real app)**
1. Pass the Level 1 quiz → Level 1 projects unlock and Level 2 opens.
2. Open the pencil holder → print its project sheet.
3. Mark a project as built with the PIN → project badge appears; certificate prints.
4. Simple Designer: build a two-board design; the cut list matches a hand calculation.

## 10. Out of scope for v1

Multiple kid profiles and parent dashboard (Piece 14); kids' games (Piece 9);
Finishing School content (Piece 12); more projects (Piece 16); online features
(Piece 15).
