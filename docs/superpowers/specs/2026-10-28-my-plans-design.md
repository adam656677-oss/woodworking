# My Plans — Design (Piece 17)

Date: 2026-10-28
Status: approved in conversation (three sections), awaiting written-spec review
Builds on: Design Core (Piece 1), Kids' Workshop v1 (Piece 2)

## 1. Purpose

Adam wants a button where he can add plans to the software, change them, and print a step-by-step
guide to build the project. "Add plans" means both:

- **writing his own plans** in the app, and
- **bringing in plans he already has**: bought/downloaded PDFs, phone photos of book or magazine
  pages, scanned paper plans, and web pages.

**Success:** Adam brings in a PDF plan, the app drafts its steps and cut list, he checks and fixes
the draft beside the original pages, marks it kid-friendly, and prints a build guide; his son opens
the same plan on the kids' side with "Adult does this" on steps above his tool level.

### Said by Adam vs. assumed (all confirmed in conversation)

| Said by Adam | Assumed and confirmed |
|---|---|
| Both: write plans and bring in existing ones | Plans live in `Documents\A&A Woodworking\Plans`, one folder per plan |
| Sources: PDF, phone photos, scans, web pages | Text reading (OCR) is built in and works offline; web import needs internet only while importing |
| Import should read the plan and draft steps and cut list | Drafts are imperfect (≈70–90% on clean PDFs, lower on photos); everything is reviewed beside the original |
| One shared library, Adult or Kid-friendly tag | Building a 3D model from a plan stays in Piece 15; here a design can be attached |

Constraints carried forward: Windows desktop, inches only (metric found in imports is converted and
flagged), no internet needed except for importing a web page, nothing ships until all pieces are done.

## 2. Screens

### 2.1 My Plans library
Opened from a **My Plans** button on the Master Shop toolbar and a **My Plans** tile on the Kids'
Workshop home. A grid of plan cards: picture, name, tag (Adult / Kid-friendly), difficulty stars,
time. Search by name; sort by name or last changed. Buttons: **New plan**, **Bring in a plan**.
On the kids' side only Kid-friendly plans are listed, and New / Bring in / editing are hidden
(he can open and print).

### 2.2 Plan editor (three tabs, plus Pages when the plan was imported)
1. **Overview** — name, picture (from a step photo, a page, or the attached design's 3D view),
   Kid-friendly tag, difficulty (1–3 stars), time (minutes), description, tools (picked from the
   app's tool list, so tiers and "Adult does this" work), materials and hardware (free text with an
   amount, e.g. "1-1/4" pocket screws — 24"), notes. **Attach design** (pick an `.aaw` or use the
   one open in the Master Shop) and **Open design**.
2. **Steps** — numbered steps, drag to reorder, add, delete. Each step: text, optional tool,
   optional photo, optional "show 3D view" of the attached design, optional safety tip.
3. **Cut list** — with a design attached, the cut list comes from the design (read-only here; edit
   the design). Without one, typed rows: qty, part, thickness × width × length (inch inputs, shown
   to 1/32"), wood, notes.
4. **Pages** (imported plans only) — the original pages, zoomable.

### 2.3 Bring in a plan
Choose **PDF**, **Photos** (one or more JPG/PNG/HEIC), or **Web page** (paste an address). A
progress bar shows page-by-page status with **Cancel**. Then a **side-by-side review**: original
pages on the left; drafted name, steps, cut list, tools and materials on the right. Each drafted
item is marked **check me** until accepted or edited; clicking an item highlights where it came from
on its page. **Accept all**, **Accept** per item, **Delete** per item, and normal editing. Finishing
the review saves the plan; the pages stay under the Pages tab.

### 2.4 Printed build guide
Letter, portrait, using the existing print path:
- cover: name, picture, stars, time, description;
- tools checklist (with "Adult does this" marks on the kids' version) and materials checklist;
- cut list;
- numbered steps with check boxes, step photos or 3D views, and safety tips.

The kids' version (printed from the kids' side) uses larger type.

## 3. Storage

Each plan is a folder `Documents\A&A Woodworking\Plans\<plan name>\`:

- `plan.json` — the plan (below), `formatVersion: 1`.
- `pages\page-001.png …` — imported originals; PDF pages rendered to PNG at 150 dpi.
- `photos\<id>.jpg` — step and cover photos, long side ≤ 1600 px.
- `design.aaw` — a copy of the attached design, so the plan is complete on its own.

Saved with the Piece 1 safe save (temp file, `.bak`, rename with retry). A damaged `plan.json` falls
back to its `.bak`. Copying the folder shares the plan. Folder names come from the plan name with
characters Windows forbids removed; a clash adds " (2)", " (3)" ….

```
Plan = {
  formatVersion: 1, id, name, kidFriendly: boolean, stars: 1|2|3, minutes: number,
  description, picture?: { kind: 'photo'|'page'|'design', ref: string },
  tools: toolId[], materials: { text, amount }[], notes,
  steps: { id, text, tool?, photo?, showDesign?: boolean, tip? }[],
  cutRows: { id, qty, part, thickness, width, length, wood, notes }[],   // used when no design
  design?: 'design.aaw',
  source?: { kind: 'pdf'|'photos'|'web', name: string, url?: string, pages: number },
  review?: { itemId: string; page: number; box: [x, y, w, h] }[],         // where drafted items came from
  unchecked: string[]                                                      // drafted item ids not yet accepted
}
```

## 4. Import pipeline (all on this computer)

1. **PDF** — read each page's text with positions (pdf.js). A page with less than 20 characters of
   text is treated as a scan and goes to step 2. Every page is also rendered to PNG for the Pages tab.
2. **Images** (photos, scanned pages) — auto-rotate from EXIF, grayscale, contrast stretch, then OCR
   (Tesseract, English data bundled with the app, no download). Words below 60% confidence are
   marked uncertain.
3. **Web page** — load the address in a hidden window (no sign-in, 30-second limit), save it as a
   PDF, then step 1.
4. **Drafting** from the text lines:
   - **Name** — the largest text on page 1 (PDF) or the first line (images).
   - **Steps** — lines starting `1.`, `1)`, `Step 1`, `Step 1:` (numbers in order), each with the
     following lines until the next step or a heading.
   - **Cut list** — lines with a quantity and three dimensions or a nominal size and length, e.g.
     `2 - 3/4 x 5-1/2 x 24"`, `(2) 1x6 @ 24"`, `Side: 3/4" x 11-1/4" x 30-1/2"`, `2 Sides 3/4 x 11 1/4 x 30 1/2`,
     and tables whose header row has Qty/Quantity, Part/Name/Description, and size columns
     (T/W/L or Thickness/Width/Length or Size). Nominal lumber (1x2 … 1x12, 2x2, 2x4, 2x6) becomes
     actual size (3/4 × 1-1/2 … 1-1/2 × 5-1/2). Fractions `5-1/2`, `5 1/2`, `5½`, `5.5` are read;
     feet `2'` become 24".
   - **Tools** — words matched against the app's tool list (and common names: "Kreg jig" →
     pocket-hole jig is noted in materials as a tool the app doesn't list).
   - **Materials** — lines matching a materials word list (screws, nails, glue, hinges, pulls,
     slides, finish, sandpaper, dowels, biscuits, brads) with their amounts.
   - **Metric** — any `mm`/`cm` measurement is converted to inches (nearest 1/32") and flagged
     "check me — converted from metric".
   - Any number containing an uncertain OCR word is flagged instead of guessed.
5. Every drafted item records the page and box it came from (for the review highlight) and starts in
   `unchecked`.

## 5. Errors and edge cases

- **Nothing readable on a page** — the page is kept; the review shows "Nothing readable on page N —
  type the steps yourself."
- **Locked or damaged PDF** — "This PDF is locked (or damaged) — open it in your PDF reader and print
  it to a new PDF, then bring that in." Nothing is saved.
- **Web page fails** (no internet, timeout, sign-in wall) — plain message; suggests saving the page
  as PDF in the browser and bringing that in. Nothing is saved.
- **Cancel during import** — the partial plan folder is removed; nothing is left behind.
- **Damaged `plan.json`** — the `.bak` is used and a notice says so; if both are bad the plan is
  listed as "Can't be opened" with its folder path.
- **Attached design missing** — the plan's own `design.aaw` copy is used; if that is gone too, the
  Cut list tab falls back to typed rows with a notice.
- **Kid-friendly plan with steps above the child's tier** — "Adult does this", as in Piece 2. Adult
  plans never appear on the kids' side.

## 6. Testing

**Unit**
- Drafting rules against a fixture of at least 30 lines covering every cut-list form in §4.4, step
  numbering forms, nominal → actual conversion, feet, `½`-style fractions, metric conversion with
  flag, and an uncertain-OCR number being flagged.
- Table detection from positioned text (Qty / Part / T / W / L headers).
- Plan save/load round trip, `.bak` fallback, folder-name cleaning and clash numbering, attached
  design copied into the plan.
- Kid filtering of the library and "Adult does this" on plan steps.

**OCR**
- Two sample pages shipped with the tests: a clean text PDF page, and a photo-style image (tilted
  4°, low contrast). The photo page must yield its numbered steps and at least 4 of its 5 cut-list
  rows.

**End-to-end (real app)**
1. Write a plan with three steps and two typed cut rows; print the guide (print stubbed).
2. Bring in the sample PDF; accept the drafted cut list; it matches the expected rows.
3. Bring in the sample photo; steps are drafted and marked check me.
4. Mark a plan kid-friendly; it appears on the kids' side with "Adult does this" on the drill step at
   Beginner tier; an Adult plan does not appear.

## 7. Out of scope

Building a 3D design from a plan automatically (Piece 15), sharing plans online, handwriting
recognition beyond what OCR reads, languages other than English.
