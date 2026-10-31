# Piece 15 — Smart Helpers: plan

Spec: docs/superpowers/specs/2026-10-31-smart-helpers-design.md

1. Pure checks (tests/smart/smart.test.ts): src/smart/plan.ts (checkPlan, scalePlan, stockFor, planToProject),
   src/smart/wood.ts (checkWoodAnswer), src/smart/describe.ts (offline matchTemplate, checkDescribeAnswer,
   templateMenu), src/smart/listen.ts (ClapDetector, rms).
2. electron/ai.ts (tests/electron/ai.test.ts): key encrypted with safeStorage (base64 in a file), settings (model),
   buildRequest per helper, answerJson, ask (timeout, plain errors). IPC smart:status/setKey/setModel/ask in
   main.ts; AA_AI_URL and AA_TEST_PLAIN_KEY for tests only.
3. UI: src/smart/smartStore.ts, src/smart/ui/SmartDialogs.tsx (settings, Photo → plan with "trace instead",
   wood ID with Library links, Describe with offline match, helper build-steps panel → new plan), HandsFree in
   Shop Mode; entry points: Home, Toolbar "✨ Helpers", StartPanel, Library.
4. E2E tests/e2e/smart.spec.ts with a local stand-in server.
