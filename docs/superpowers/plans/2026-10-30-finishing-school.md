# Piece 12 — Finishing School (plan, as built)

Spec: docs/superpowers/specs/2026-10-29-finishing-school-design.md (Mohawk's site is www.mohawk-finishing.com, with the hyphen).

- `src/finish/finishes.ts` — 24 finishes (topcoats, colours, sealers, filler) with ratings, food safety, methods, touch/recoat/cure times, sheens, smell/VOC, ambering, flammability, oily-rag risk, coats, tips; shellac cut chart; `hoursText`.
- `compat.ts` — `canGoOver(top, under)` → yes / barrier (with what) / no, always with why and when.
- `select.ts` — `rankFinishes(wants, methods)` with reasons and warnings.
- `schedule.ts` — `Project.finish` (format v11): six templates, `checkSchedule` (compat between successive finishes), `scheduleTime`, `stepText` (adds oily-rag and spray warnings).
- `lessons.ts` — 24 adult lessons in six groups; `mohawk.ts` — about, ten product families in our words with generic equivalents, links, not-affiliated note.
- `kids.ts` — kid schedules (wipe-on water-based, food-safe oil, outdoor paint outside only; sprays are a grown-up's job); kid lesson "Finishing basics" (level 2), "Finish sampler" project + design, three new tools.
- UI: Finishing School screen (Home tile, toolbar "Finish"): Lessons, Choose a finish (with compare), Can I put…?, My finishing schedule (edit, reorder, remove, warnings, total time), Mohawk products (links via `aa:openLink`, https + mohawk-finishing.com only).
- Integration: Shop Mode gets "Finish: …" steps after assembly; kids' Shop Mode and project sheets get finishing steps; plan packet gets a Finishing schedule page.
- Tests: tests/finish/finish.test.ts, ui.test.tsx; tests/e2e/finish.spec.ts.
