# Piece 9 — Kids' Games: plan

Spec: docs/superpowers/specs/2026-10-31-kids-games-design.md

1. Logic (pure, tested in tests/games/games.test.ts): `src/games/rng.ts` (seeded), `tape.ts` (levels, rounds with
   likely-mistake distractors, find-it tolerance, explanations), `hazards.ts` (8 hazards with spots, why and fix),
   `woods.ts` (8 kids' woods with unique clues), `joints.ts` (grid puzzles: '#' wood, 's' socket; `fits` checks
   every cell), `lathe.ts` (cut with falloff, tool-rest limit, score and too-deep spots), `grain2d.ts` (board
   picture with the realistic view's ring idea).
2. UI in `src/games/ui/`: GamesHome (5 tiles), TapeGame, HazardGame (drawn shop SVG), WoodGame (canvas board),
   JointGame, LatheGame (pointer-held gouge, rAF spin), shared GamePage/useRound/RoundEnd/Feedback (rounds of 10,
   nothing kept after a round).
3. Kids' Workshop wiring: pages `games` and `game`, a Games tile on Kids' Home, a parent switch (`gamesOff` in
   progress, PIN-checked like the tool level).
4. E2E tests/e2e/games.spec.ts: a full tape round, find-it, a hazard and a hint, a joint puzzle fitted and named,
   a turning scored, a wood question.
