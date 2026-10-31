# Piece 8 — Realistic Rendering: plan

Spec: docs/superpowers/specs/2026-10-29-rendering-design.md

1. `src/render/materials.ts` (pure): species → WoodLook (Library colours, ring spacing/contrast, pores for ring-porous
   woods, plywood with face species, MDF), per-part variation and seed, grain frame (along x/y, pith below the face),
   finishing schedule → FinishLook (stain/dye tint from words on the can, amber of oil-based finishes, paint colour,
   sheen → roughness/clearcoat), light presets, export size (≤ 4096 px).
2. `src/render/woodMaterial.ts`: MeshPhysicalMaterial with an onBeforeCompile shader growing rings round the pith
   line in the part's own coordinates (end grain and cathedrals fall out of it), fibre streaks, pores, plywood edge
   plies and glue lines, MDF speckle; tint, amber, paint.
3. `src/render/ui/Stage.tsx`: RoomEnvironment (generated, Z-up rotation), key/fill lights with soft shadows, floor and
   a shadow catcher for clear pictures, Neutral tone mapping; GTAO occlusion pass (EffectComposer) when Shadows is on;
   `Camera` registers the capture function (pixel ratio up to 4096 px, background, composer).
4. `src/render/renderStore.ts`: look, light, effects, picture dialog, rendered views (display only, not saved).
5. UI: Look / Light / Shadows / 📷 Picture… in the view strip; kids get a 🌳 Real wood button; Picture dialog
   (1×/2×/4×, clear background, Save PNG via `aa:savePng`, Render views → plan packet page "Rendered pictures").
6. BoardMesh: realistic material, casts/receives shadows, no drawn edges except the selected part.
7. Tests: tests/render/materials.test.ts; e2e tests/e2e/rendering.spec.ts (realistic look, lighting presets, 2× PNG
   is twice the view size, clear PNG is RGBA, rendered views reach the packet).
