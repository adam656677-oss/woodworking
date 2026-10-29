# Finishing School — Design (Piece 12)

Date: 2026-10-29
Status: decided by Claude under Adam's "run straight through" instruction; scope as in the Design Core spec §2.2

## 1. Where

- **Master Shop → Finishing School** (home screen tile and toolbar ▸ Finish): lessons, the finish selector,
  compatibility checker, schedule builder, touch-up and repair, safety, and the Mohawk section.
- **Kids' Workshop → Finishing basics**: a level-2 lesson set (already started with `kid-finishes`) expanded,
  the finish-sampler project, and finishing steps on every kid project sheet.

## 2. Content (written in the app's own words, read-aloud on the kids' side)

- Lessons (cards like kids' lessons, adult typography): surface prep; raising grain; grain filling; sealing;
  dyes vs pigment vs gel stains; glazes and toners; colour matching; oils; wax; shellac (cut chart);
  nitrocellulose lacquer; pre-cat and post-cat (conversion varnish); varnish/polyurethane; waterborne;
  application by wipe, brush, spray; sheen; rubbing out; dry and recoat times; food safety; finishing
  safety (ventilation, respirators, flammability, spray safety, rag disposal); touch-up and repair (damage
  analysis, fillers, burn-in, colour replacement, graining, sheen adjustment, scratch removal, care).
- **Finish data** (`finishes.json`): ~20 finish types with properties: durability (1–5), water/heat/solvent
  resistance, repairability, ease, food-safe when cured, application methods, dry-to-touch and recoat times,
  sheens, VOC/solvent, what it can go over / under.

## 3. Tools

- **Finish selector:** pick what matters (durable, food-safe, easy, clear/no yellowing, water-resistant,
  repairable, spray/brush/wipe, low smell); finishes ranked with reasons; compare two or three side by side.
- **Compatibility checker:** "Can I put X over Y?" → Yes / With a barrier coat (dewaxed shellac) / No, with why.
- **Schedule builder:** per project (stored `Project.finish?: FinishSchedule` — steps: prep, colour, seal,
  topcoat coats, rub-out; product (generic or Mohawk), method, coats, dry time, sheen, notes). Templates:
  "Oil & wax", "Shellac", "Wipe-on poly", "Waterborne", "Spray lacquer", "Painted". Shows total time; feeds
  Shop Mode steps, the plan packet and rendering (colour/sheen, Piece 8). Validated with the compatibility
  rules (warns on a bad order).
- Kids: the sampler sheet printable; the kid project sheets' finishing steps come from a kid schedule
  (wipe-on water-based, paste wax, food-safe oil) with drying times and "Adult does this" on sprays.

## 4. Mohawk Finishing Products section

- Who Mohawk is; product families described in our own words (stains incl. Ultra® Penetrating and Wiping
  Wood™, toners and Tone Finish® aerosols, lacquers and coatings, sealers, Fil-Stik® putty sticks, Hard-Fill
  burn-in sticks, Blendal® colour sticks and powders, touch-up and graining markers, care products) with what
  each is for; lessons that name Mohawk products as an option alongside generic equivalents; links (opened in
  the system browser) to Mohawk's technical data sheets, colour chart and training workshops. A clear
  "not affiliated with Mohawk" line; no copied text, photos or logos.
- Links are checked at build time by a test that they are https and point at mohawkfinishing.com.

## 5. Testing

Unit: finish data integrity; selector ranking; compatibility rules (shellac over anything, poly over oil after
cure, lacquer over oil-based stain only when dry, waterborne over oil = barrier); schedule validation and
totals; file round-trip of schedules. UI: lessons open, selector, checker, builder. E2E: build a schedule for
a bookshelf and see it in Shop Mode steps and the plan packet.
