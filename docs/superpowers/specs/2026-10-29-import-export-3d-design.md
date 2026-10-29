# 3D Import & Export — Design (Piece 18)

Date: 2026-10-29
Status: decided by Claude under Adam's "run straight through" instruction; Adam can redirect at any time

## 1. Purpose

Get designs out to other tools (3D printers, laser/CNC, other CAD, web viewers) and bring outside models
in as references to design around (hardware, an existing piece, an appliance).

## 2. Export (File ▾ → Export…; whole design, or the selection / a group)

| Format | What's in it | Notes |
|---|---|---|
| **STL** (binary) | one solid per part merged into a mesh, finished shapes (cuts, shapes, turnings, profiles) | inches → the file is in **inches** by default, option **millimetres** (×25.4) for slicers that assume mm |
| **OBJ** (+ MTL) | one named object per part (`Side`, `Shelf_2`), material per wood | units as STL |
| **3MF** | one object per part with names, unit="inch" in the file (3MF carries units) | zipped XML |
| **glTF** (.glb) | the scene with part names and wood colours, groups as nodes | metres per glTF rules (inches × 0.0254) |
| **STEP** (AP214, faceted) | each part as a closed faceted solid (`MANIFOLD_SOLID_BREP` of triangles), named | exact for flat parts; curved parts are faceted (ruling: no NURBS kernel offline) |
| **DXF** (R12 ASCII) | **flat patterns**: each part's outline (shape or rectangle, holes as circles, grooves as dashed lines on a `GROOVES` layer) laid out in rows 1" apart, labelled; or **one part** | inches; for laser/CNC/cutting templates |

- Export writes through the save dialog; file name defaults to the project name. A summary after export:
  "Exported 14 parts to bookshelf.stl (inches)".

## 3. Import (File ▾ → Import reference model…)

- **STL, OBJ, 3MF, STEP (AP203/214 faceted and simple B-rep planar faces), glTF/GLB**. Units asked on import
  (inches / millimetres / centimetres / metres; guessed from the file where it says, else from the size —
  "This model is 254 units across — inches or millimetres?").
- Becomes a **reference object**: `Project.models?: { id, name, format, mesh (stored as compressed binary
  data URL of the triangles), position, rotation, scale, colour, opacity, locked, hidden }[]` (format 9).
  Shown in 3D in a neutral grey, listed in the Parts panel under "Reference models" with eye/lock/delete;
  move/rotate with the panel boxes. **Not** in the cut list or weight; **included** in the interference and
  clearance checks ("Shelf runs into Microwave") — opt-out per model.
- Size limit: 200,000 triangles per model (larger files are refused with the count and a hint to simplify).
- STEP with curved (non-planar) faces: imported faces that can't be read are skipped with a count
  ("12 curved faces couldn't be read — the model may have gaps").

## 4. Testing

Unit: each writer against hand-made expectations (STL triangle count/normals/bounds, OBJ names, 3MF XML,
GLB header/JSON, STEP entity structure parses back with our reader, DXF entities and layers); each reader
on small fixture files (cube in every format, units). Round trips: export → import gives the same bounds.
E2E: export STL of a bookshelf (file exists, bounds right); import a STEP cube as a reference, it shows in
the list and the interference check finds a shelf through it.
