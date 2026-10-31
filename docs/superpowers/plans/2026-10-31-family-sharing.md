# Piece 14 — Family & Sharing: plan

Spec: docs/superpowers/specs/2026-10-31-family-sharing-design.md

1. electron/kidsStore.ts: profiles (kids-profiles.json, 'main' = kids-progress.json), add/switch/remove, family
   progress, photo names per child; IPC kids:profiles/switch/addProfile/removeProfile/family (PIN where it matters).
2. Renderer kids store: profiles, switchChild, refreshProfiles; FamilyPanel (dashboard, add/remove) in Parent area;
   WhoIsWorking on Kids' Home.
3. electron/backup.ts: collect/write/read/restore backups, write/read packages; IPC aa:backup/restore/
   savePackage/openPackage.
4. src/family/package.ts (make/open packages); ShareDialog + openShared (Toolbar Share menu); BackupBar on Home.
5. Tests: tests/electron/kidsStore.test.ts, tests/electron/backup.test.ts, tests/family/package.test.ts,
   tests/e2e/family.spec.ts.
