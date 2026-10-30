# 3D Import & Export (Piece 18) — Plan

Spec: docs/superpowers/specs/2026-10-29-import-export-3d-design.md

1. Pure: src/exchange/meshes.ts (each part's finished solid as world triangles; names; weld), writers.ts (STL binary in/mm, OBJ+MTL, 3MF in inches, GLB in metres Y-up with group nodes, STEP AP214 faceted solids), flat.ts (DXF R12 flat patterns with OUTLINE/CUTOUTS/GROOVES/TEXT), readers.ts (STL, OBJ, 3MF, glTF/GLB, STEP faceted + planar B-rep, units, 200k-triangle limit, unit guess), models.ts (packed meshes, add/update/remove, matrix, box).
2. Model: Project.models (format 9) with checks; interference and clearance include models unless left out.
3. Electron: exportFile (OBJ writes its MTL beside it), importModel.
4. UI: 3D files ▾ (Export…, Import reference model…), ExchangeDialog (export format/scope/units; import with units and size), Models3D, Reference models list with settings.
5. Tests: writer/reader round trips for every format, STEP B-rep fixture with a curved face, units, limits, DXF; models pack/units/file/interference; e2e export STL + import STEP cube + interference.
