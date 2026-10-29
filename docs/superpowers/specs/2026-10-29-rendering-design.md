# Realistic Rendering — Design (Piece 8)

Date: 2026-10-29
Status: decided by Claude under Adam's "run straight through" instruction; Adam can redirect at any time

## 1. What

- **Render mode** toggle in the 3D view (CAD look ↔ realistic). Realistic mode: physically based materials
  per species with **procedural grain** (generated in a shader from ring/ray/pore noise — no copied photos):
  colour ramps from the Deep Library swatches, grain running along the part's grain direction, end grain on
  ends, flat-sawn cathedrals on face grain, plywood face veneer with edge plies, MDF uniform. Colour varies
  slightly per part so boards don't look cloned.
- **Finish** from the project's finishing schedule (Piece 12): tint (stain/dye colour), sheen (flat/satin/
  semi/gloss → roughness and clearcoat), amber of oil-based finishes; painted finishes as solid colour.
- **Lighting**: soft studio environment (generated, no HDR files), shadows, ambient occlusion (SSAO), a floor
  with contact shadows; presets Studio / Workshop / Daylight.
- **Image export**: PNG at 1×/2×/4× the view size (up to 4096 px), transparent background option, from the
  current camera; "Render views" makes front/iso/exploded images for the plan packet.

## 2. Testing

Unit: species → material parameters; finish → colour/sheen; grain direction mapping per part orientation.
Visual review via screenshots (render of the bookshelf in pine, oak with a satin finish, painted). E2E: switch
to realistic, export a 2× PNG (file exists, size right).
