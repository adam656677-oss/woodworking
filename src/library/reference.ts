// Reference pages for the Deep Library, in our own words. Times are typical at about 70°F — follow the label.

export type Glue = { id: string; name: string; open: string; clamp: string; cure: string; water: string; gaps: string; cleanup: string; best: string }
export const GLUES: Glue[] = [
  { id: 'pva1', name: 'PVA (yellow glue) — Type I', open: '5–10 min', clamp: '30–60 min', cure: '24 hours', water: 'Water-resistant (ANSI Type I)', gaps: 'Poor — needs tight joints', cleanup: 'Water while wet; scrape when rubbery', best: 'Outdoor furniture that sees rain' },
  { id: 'pva2', name: 'PVA (yellow glue) — Type II', open: '5–10 min', clamp: '30–60 min', cure: '24 hours', water: 'Water-resistant (Type II): not for constant wet', gaps: 'Poor', cleanup: 'Water while wet', best: 'Most indoor furniture; cutting boards (Type II or III)' },
  { id: 'pva3', name: 'PVA — Type III (waterproof)', open: '8–10 min', clamp: '30–60 min', cure: '24 hours', water: 'Waterproof (Type I test) — not for below the waterline', gaps: 'Poor', cleanup: 'Water while wet', best: 'Outdoor projects, cutting boards, longer assemblies' },
  { id: 'white', name: 'White glue (PVA)', open: '10–15 min', clamp: '1 hour', cure: '24 hours', water: 'None', gaps: 'Poor', cleanup: 'Water', best: 'Kids\' projects, crafts, indoor work' },
  { id: 'hide-hot', name: 'Hot hide glue', open: '1 min or less', clamp: 'Rub joint or clamp a few hours', cure: '24 hours', water: 'None — and that\'s the point: it can be taken apart', gaps: 'Fair', cleanup: 'Warm water', best: 'Antique repair, instruments, veneering; reversible with heat and moisture' },
  { id: 'hide-liquid', name: 'Liquid hide glue', open: '20–30 min', clamp: '12 hours', cure: '24 hours', water: 'None', gaps: 'Fair', cleanup: 'Warm water', best: 'Complicated glue-ups that need time; repairs that may need undoing' },
  { id: 'poly', name: 'Polyurethane glue', open: '15–20 min', clamp: '1–4 hours', cure: '24 hours', water: 'Waterproof', gaps: 'Foams to fill, but the foam is weak', cleanup: 'Mineral spirits wet; scrape when cured', best: 'Oily woods, mixed materials, outdoors. Needs moisture to cure; wear gloves — it stains skin.' },
  { id: 'epoxy-5', name: 'Epoxy — 5-minute', open: '3–5 min', clamp: '15–30 min', cure: '24 hours', water: 'Waterproof', gaps: 'Excellent', cleanup: 'Alcohol or vinegar wet; sanding when cured', best: 'Quick repairs, small parts, inlays' },
  { id: 'epoxy-slow', name: 'Epoxy — slow-set', open: '30–60 min', clamp: '6–12 hours', cure: '1–7 days', water: 'Waterproof', gaps: 'Excellent; structural', cleanup: 'Alcohol wet', best: 'Boats, oily woods, loose joints, filling voids' },
  { id: 'ca', name: 'CA (super glue)', open: 'Seconds', clamp: 'Hold 10–60 seconds', cure: 'Minutes', water: 'Fair', gaps: 'Thin: none; thick/gel: some', cleanup: 'Acetone', best: 'Small repairs, filling cracks in turnings, holding parts while glue sets. Bonds skin instantly.' },
  { id: 'contact', name: 'Contact cement', open: 'Let both surfaces dry 15 min, then join', clamp: 'None — press with a roller', cure: '24 hours', water: 'Good', gaps: 'None', cleanup: 'Solvent (or water for water-based)', best: 'Plastic laminate, veneer, leather. Bonds on touch — no repositioning. Solvent types are very flammable.' }
]

export type Article = { id: string; title: string; group: 'Techniques' | 'Sharpening' | 'Safety'; paras: string[] }
export const ARTICLES: Article[] = [
  { id: 'reading-grain', title: 'Reading grain', group: 'Techniques', paras: ['Plane and rout "downhill": with the grain fibres running up and away from the cut, like stroking a cat the right way.', 'Look at the edge of a board: the lines show which way the fibres run out of the face. Tear-out means you\'re cutting against them — turn the board around or take lighter cuts.'] },
  { id: 'milling', title: 'Milling rough lumber flat and square', group: 'Techniques', paras: ['Joint one face flat, then one edge square to it. Plane the other face parallel to the first, then rip the second edge parallel and crosscut to length.', 'Let freshly milled boards rest a day before final thicknessing: they move as stresses release.'] },
  { id: 'glue-ups', title: 'Glue-ups', group: 'Techniques', paras: ['Dry-fit first, with the clamps set. Plan the order and have rags and a square ready.', 'Even squeeze-out along the joint means enough glue. Alternate clamps above and below a panel to keep it flat; just snug, not crushing.', 'Check diagonals: equal diagonals mean square.'] },
  { id: 'wood-movement', title: 'Designing for wood movement', group: 'Techniques', paras: ['Wood swells and shrinks across its width with the seasons, hardly at all along its length.', 'Never glue a wide solid board rigidly across the grain of another: fasten tabletops with buttons or figure-8s, let panels float in grooves, use slotted screw holes, and glue breadboard ends only in the middle.', 'Plywood and MDF barely move — no special care needed.'] },
  { id: 'joinery-choice', title: 'Choosing a joint', group: 'Techniques', paras: ['Long grain to long grain glues strongly; end grain hardly glues at all — it needs a mechanical joint (dowels, tenons, screws).', 'Dados and rabbets locate shelves and backs; mortise and tenons carry chair and table loads; dovetails hold drawer fronts against pulling.'] },
  { id: 'sharp-why', title: 'Why sharp matters', group: 'Sharpening', paras: ['A sharp edge cuts cleanly with little force. A dull one crushes fibres, tears out and slips — which is how most hand-tool cuts happen.'] },
  { id: 'sharp-how', title: 'Sharpening chisels and plane irons', group: 'Sharpening', paras: ['Flatten the back near the edge first, on your coarsest stone, then finer ones.', 'Grind or hone the bevel (about 25°), then add a small micro-bevel (about 30°) on the finest stone. Raise a burr, then remove it on the back.', 'Stones: 1000 grit to shape, 4000–8000 to polish. Diamond plates stay flat; water stones cut fast but need flattening.'] },
  { id: 'sharp-test', title: 'Is it sharp?', group: 'Sharpening', paras: ['Look straight down at the edge under a light: a sharp edge reflects no light at all; dull spots shine.', 'It should pare end grain of pine cleanly without crushing.'] },
  { id: 'kickback', title: 'Kickback on the table saw', group: 'Safety', paras: ['Kickback happens when the wood pinches the back of the blade or twists against the fence and is thrown back hard.', 'Always use the riving knife or splitter and the guard. Never rip freehand or crosscut against the fence; use a sled or the miter gauge.', 'Stand to the side of the blade, not behind it, and use push sticks for anything narrower than about 6".'] },
  { id: 'push-sticks', title: 'Push sticks, push blocks and featherboards', group: 'Safety', paras: ['Keep hands at least 6" from any blade or cutter. Push sticks for narrow rips; push blocks on the jointer; featherboards to hold work against the fence.', 'Make extra push sticks — they are meant to get cut.'] },
  { id: 'guards', title: 'Blade guards and dust collection', group: 'Safety', paras: ['Leave guards on whenever the cut allows. Most injuries happen in the few seconds after someone takes one off "just for this cut".'] },
  { id: 'dust', title: 'Dust', group: 'Safety', paras: ['Fine dust you can\'t see does the damage. Collect at the tool, run an air filter, and wear a well-fitted N95 or better.', 'Some woods (western red cedar, rosewoods, iroko, teak and others) are known irritants or sensitizers — see each species page.'] },
  { id: 'hearing', title: 'Hearing and eyes', group: 'Safety', paras: ['Routers, planers and saws run around 95–110 dB: wear hearing protection every time. Hearing loss is permanent.', 'Safety glasses for every power tool; a face shield for turning.'] },
  { id: 'shop-habits', title: 'Shop habits', group: 'Safety', paras: ['Unplug a tool to change a blade or bit. No loose sleeves, gloves near spinning blades, or jewellery.', 'Don\'t work tired or rushed. Keep the floor clear. Keep a first-aid kit and a fire extinguisher where you can reach them.'] }
]

export const HARDWOOD_GRADES = [
  { grade: 'FAS (Firsts and Seconds)', what: 'The best: at least 6" wide and 8\' long, about 83% or more clear cuttings.', use: 'Long clear parts, fine furniture.' },
  { grade: 'FAS One Face (F1F) / Selects', what: 'FAS on the better face; the back can be #1 Common.', use: 'When only one face shows.' },
  { grade: '#1 Common', what: 'At least 3" wide and 4\' long, about 67% clear in shorter pieces.', use: 'Cabinet parts and furniture with shorter parts — often the best value.' },
  { grade: '#2A Common', what: 'About 50% clear; more knots and defects.', use: 'Small parts, rustic work, flooring.' }
]
export const SOFTWOOD_GRADES = [
  { grade: 'Clear / C and Better Select', what: 'Few or no knots.', use: 'Trim, furniture.' },
  { grade: '#1 and #2 (Common)', what: 'Sound, tight knots.', use: 'Shelving, general projects (#2 is the usual home-centre board).' },
  { grade: '#3 and Utility', what: 'Loose knots, wane.', use: 'Rough work, crates.' },
  { grade: 'Construction / Stud', what: 'Framing grades graded for strength, not looks.', use: 'Framing, workbench frames.' }
]

/** Nominal and actual (dry, surfaced) sizes of dimensional lumber. */
export const NOMINAL: { nominal: string; actual: string }[] = [
  ['1x2', '3/4" × 1-1/2"'], ['1x3', '3/4" × 2-1/2"'], ['1x4', '3/4" × 3-1/2"'], ['1x6', '3/4" × 5-1/2"'], ['1x8', '3/4" × 7-1/4"'],
  ['1x10', '3/4" × 9-1/4"'], ['1x12', '3/4" × 11-1/4"'], ['2x2', '1-1/2" × 1-1/2"'], ['2x4', '1-1/2" × 3-1/2"'], ['2x6', '1-1/2" × 5-1/2"'],
  ['2x8', '1-1/2" × 7-1/4"'], ['2x10', '1-1/2" × 9-1/4"'], ['2x12', '1-1/2" × 11-1/4"'], ['4x4', '3-1/2" × 3-1/2"'],
  ['4/4 hardwood', '13/16"–1" rough; 3/4" surfaced'], ['5/4 hardwood', '1-1/4" rough; 1" surfaced'], ['8/4 hardwood', '2" rough; 1-3/4" surfaced']
].map(([nominal, actual]) => ({ nominal, actual }))

/** Drill-press speeds (rpm), typical, by bit and diameter. Bigger bits and harder materials run slower. */
export const DRILL_SPEEDS: { bit: string; size: string; softwood: string; hardwood: string; plastic: string; metal: string }[] = [
  { bit: 'Twist bit', size: '1/16"–3/16"', softwood: '3000', hardwood: '3000', plastic: '2500', metal: '2500 (aluminium) / 1500 (steel)' },
  { bit: 'Twist bit', size: '1/4"–3/8"', softwood: '2500', hardwood: '1500', plastic: '1500', metal: '1500 / 1000' },
  { bit: 'Twist bit', size: '1/2"', softwood: '1500', hardwood: '1000', plastic: '1000', metal: '1000 / 500' },
  { bit: 'Brad-point bit', size: '1/4"–1/2"', softwood: '1800', hardwood: '1200', plastic: '1000', metal: '—' },
  { bit: 'Spade bit', size: '1/2"–1"', softwood: '1500', hardwood: '1000', plastic: '—', metal: '—' },
  { bit: 'Spade bit', size: '1-1/8"–1-1/2"', softwood: '1000', hardwood: '700', plastic: '—', metal: '—' },
  { bit: 'Forstner bit', size: '1/4"–1"', softwood: '1200', hardwood: '700', plastic: '500', metal: '—' },
  { bit: 'Forstner bit', size: '1-1/8"–2"', softwood: '500', hardwood: '300', plastic: '250', metal: '—' },
  { bit: 'Forstner bit', size: 'over 2"', softwood: '250', hardwood: '250', plastic: '—', metal: '—' },
  { bit: 'Hole saw', size: '1"–2"', softwood: '500', hardwood: '350', plastic: '350', metal: '250' },
  { bit: 'Hole saw', size: 'over 2"', softwood: '300', hardwood: '200', plastic: '200', metal: '150' },
  { bit: 'Plug / tenon cutter', size: '3/8"–1/2"', softwood: '1200', hardwood: '1000', plastic: '—', metal: '—' },
  { bit: 'Countersink', size: '1/2"', softwood: '1500', hardwood: '1200', plastic: '1000', metal: '500' }
]
