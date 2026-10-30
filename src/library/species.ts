// Wood species. Density (lb/ft³ at 12% moisture), Janka side hardness (lbf), total shrinkage green to oven-dry
// (tangential/radial, %) and stiffness (MOE, million psi) for North American woods follow the USDA Forest
// Products Laboratory Wood Handbook (FPL-GTR-282), chapters 4 and 5 — a public-domain US government work.
// Imported woods use typical published figures. Notes are written in our own words. Prices are rough US retail
// ranges per board foot — estimates only; edit them for your area.

export type SpeciesKind = 'hardwood' | 'softwood' | 'imported'
export type Species = {
  id: string
  name: string
  aka: string[]
  kind: SpeciesKind
  density: number
  janka: number
  shrinkT: number
  shrinkR: number
  moe: number
  /** Dimensional change per 1% moisture change, where the Handbook lists it (tangential, radial). */
  coef?: [number, number]
  colour: string
  work: string
  finish: string
  uses: string
  /** Health note (dust, allergy) in plain words; empty when nothing notable. */
  caution: string
  price: [number, number]
  /** Naturally resists decay well enough for outdoor use. */
  outdoor: boolean
  /** A good, commonly used choice for things that touch food (cutting boards, utensils). */
  food: boolean
  source: 'handbook' | 'published'
}

const S = (id: string, name: string, aka: string[], kind: SpeciesKind, d: number, janka: number, t: number, r: number, moe: number,
  colour: string, work: string, finish: string, uses: string, caution: string, price: [number, number], o: { outdoor?: boolean; food?: boolean; coef?: [number, number] } = {}): Species =>
  ({ id, name, aka, kind, density: d, janka, shrinkT: t, shrinkR: r, moe, colour, work, finish, uses, caution, price, outdoor: !!o.outdoor, food: !!o.food, ...(o.coef ? { coef: o.coef } : {}), source: kind === 'imported' ? 'published' : 'handbook' })

const DUST = 'Fine dust can irritate the nose, eyes and skin; wear a dust mask.'

export const SPECIES: Species[] = [
  // North American hardwoods
  S('red-alder', 'Red alder', ['alder'], 'hardwood', 28, 590, 7.3, 4.4, 1.38, '#c99a72', 'Soft, easy to machine and sand; dents easily.', 'Blotches with pigment stain; use a conditioner or gel stain.', 'Cabinets, furniture, carving.', '', [4, 7]),
  S('white-ash', 'White ash', ['ash', 'american ash'], 'hardwood', 42, 1320, 7.8, 4.9, 1.74, '#d9c7a1', 'Works well with sharp tools; bends well when steamed.', 'Open grain; fill for a smooth finish. Stains evenly.', 'Tool handles, bats, chairs, bent parts.', '', [5, 9], { coef: [0.00274, 0.00169] }),
  S('aspen', 'Quaking aspen', ['aspen', 'poplar (aspen)'], 'hardwood', 26, 350, 6.7, 3.5, 1.18, '#e7dcc1', 'Soft and light; fuzzy if tools are dull.', 'Plain; takes paint well.', 'Sauna benches, crates, toys, paper.', '', [3, 6]),
  S('basswood', 'Basswood', ['linden', 'lime'], 'hardwood', 26, 410, 9.3, 6.6, 1.46, '#efe3c8', 'Very soft, fine and even: the classic carving wood.', 'Takes paint well; blotches with stain.', 'Carving, models, drawer sides, toys.', '', [4, 7], { coef: [0.0033, 0.0023] }),
  S('american-beech', 'American beech', ['beech'], 'hardwood', 45, 1300, 11.9, 5.5, 1.72, '#d7b48d', 'Hard and strong; moves a lot with humidity.', 'Fine, closed grain; finishes smoothly.', 'Workbenches, tool bodies, chairs, utensils.', '', [5, 8], { food: true, coef: [0.00431, 0.0019] }),
  S('yellow-birch', 'Yellow birch', ['birch'], 'hardwood', 43, 1260, 9.5, 7.3, 2.01, '#dcc39b', 'Works well; can tear out on figured boards.', 'Blotches with pigment stain; dyes or gel stain work better.', 'Furniture, cabinets, plywood faces, dowels.', '', [5, 8], { food: true, coef: [0.00338, 0.00256] }),
  S('paper-birch', 'Paper birch', ['white birch'], 'hardwood', 38, 910, 8.6, 6.3, 1.59, '#e8d9bc', 'Works easily; turns well.', 'Like yellow birch.', 'Turnings, spools, toys, plywood.', '', [4, 7], { food: true }),
  S('butternut', 'Butternut', ['white walnut'], 'hardwood', 27, 490, 6.4, 3.4, 1.18, '#c8a477', 'Soft and easy to carve.', 'Takes stain well; open grain.', 'Carving, furniture, panelling.', '', [6, 10]),
  S('black-cherry', 'Black cherry', ['cherry', 'american cherry'], 'hardwood', 35, 950, 7.1, 3.7, 1.49, '#c27e5a', 'Machines and sands beautifully; burns easily on the router or saw.', 'Darkens with light; stain can blotch, so many leave it natural.', 'Fine furniture, cabinets, carving, turning.', '', [7, 12], { food: true, coef: [0.00274, 0.00126] }),
  S('american-chestnut', 'American chestnut (reclaimed)', ['chestnut', 'wormy chestnut'], 'hardwood', 30, 540, 6.7, 3.4, 1.23, '#bf9a6a', 'Easy to work; usually reclaimed with nail and worm holes.', 'Takes finish well.', 'Furniture, panelling, picture frames.', '', [12, 25], { outdoor: true }),
  S('cottonwood', 'Eastern cottonwood', ['cottonwood', 'poplar (cottonwood)'], 'hardwood', 28, 430, 9.2, 3.9, 1.37, '#e2d4b7', 'Soft; fuzzy surface and can warp.', 'Best painted.', 'Crates, pallets, hidden parts.', '', [2, 4]),
  S('american-elm', 'American elm', ['elm', 'white elm'], 'hardwood', 36, 830, 9.5, 4.2, 1.34, '#c9a37a', 'Interlocked grain: hard to split, can tear out; bends well.', 'Open grain; attractive with a clear finish.', 'Chair seats, bent parts, furniture.', '', [5, 9]),
  S('hackberry', 'Hackberry', [], 'hardwood', 37, 880, 8.9, 4.8, 1.19, '#ddd0b1', 'Works and bends well.', 'Looks like a pale ash; stains well.', 'Furniture, bent parts.', '', [4, 7]),
  S('hickory', 'Shagbark hickory', ['hickory'], 'hardwood', 50, 1820, 10.5, 7.0, 2.16, '#c9a27a', 'Very hard and tough; dulls tools; strong bending wood.', 'Takes stain fairly well.', 'Tool handles, chairs, flooring, smoking.', '', [5, 9]),
  S('pecan', 'Pecan', [], 'hardwood', 46, 1820, 8.9, 4.9, 1.73, '#c39d73', 'Hard and tough like hickory.', 'Finishes well.', 'Flooring, furniture, handles.', '', [5, 9]),
  S('honey-locust', 'Honey locust', [], 'hardwood', 47, 1580, 6.6, 4.2, 1.63, '#c7926a', 'Hard; works fairly well.', 'Attractive under oil.', 'Furniture, posts, turning.', '', [6, 10], { outdoor: true }),
  S('black-locust', 'Black locust', ['locust'], 'hardwood', 48, 1700, 7.2, 4.6, 2.05, '#c4a85f', 'Very hard and rot-resistant; tough on tools.', 'Yellow-green, ages to brown.', 'Fence posts, outdoor furniture, decking.', '', [6, 12], { outdoor: true }),
  S('hard-maple', 'Hard maple', ['sugar maple', 'rock maple', 'maple'], 'hardwood', 44, 1450, 9.9, 4.8, 1.83, '#ecd9b5', 'Hard and dense; burns with dull cutters; can tear out on curly figure.', 'Blotches with stain; dyes or toners work better. Stays light under water-based finish.', 'Cutting boards, workbenches, flooring, furniture, butcher block.', '', [5, 9], { food: true, coef: [0.00353, 0.00165] }),
  S('soft-maple', 'Soft maple', ['red maple', 'silver maple'], 'hardwood', 38, 950, 8.2, 4.0, 1.64, '#e3cfaa', 'Easier to work than hard maple.', 'Blotches with stain like hard maple.', 'Furniture, cabinets, painted work.', '', [4, 7], { food: true }),
  S('red-oak', 'Red oak', ['northern red oak', 'oak'], 'hardwood', 44, 1290, 8.6, 4.0, 1.82, '#c8956b', 'Works well; coarse, open grain.', 'Stains evenly; fill the pores for a smooth film. Not for outdoor use — open pores let water in.', 'Furniture, cabinets, flooring, trim.', '', [4, 8], { coef: [0.00369, 0.00158] }),
  S('white-oak', 'White oak', ['oak'], 'hardwood', 47, 1360, 10.5, 5.6, 1.78, '#c7a27a', 'Works well; quartersawn shows ray fleck.', 'Stains well; fumes with ammonia. Pores are blocked (tyloses), so it holds liquid.', 'Furniture, boats, barrels, outdoor furniture, flooring.', '', [6, 12], { outdoor: true, coef: [0.00365, 0.0018] }),
  S('live-oak', 'Live oak', [], 'hardwood', 61, 2680, 9.5, 6.6, 1.98, '#a9825b', 'Extremely hard and heavy; hard on tools.', 'Finishes well.', 'Turnings, boat parts, accents.', '', [10, 20]),
  S('sassafras', 'Sassafras', [], 'hardwood', 31, 630, 6.2, 4.0, 1.12, '#c9a47c', 'Easy to work; smells sweet.', 'Looks like ash or chestnut.', 'Furniture, boats, small projects.', 'Some people react to the dust; wear a mask.', [5, 9], { outdoor: true }),
  S('sweetgum', 'Sweetgum', ['red gum', 'gum'], 'hardwood', 36, 850, 10.2, 5.3, 1.64, '#c9a687', 'Interlocked grain; can warp.', 'Takes stain well.', 'Furniture, plywood, millwork.', '', [4, 7]),
  S('sycamore', 'American sycamore', ['sycamore', 'plane tree'], 'hardwood', 34, 770, 8.4, 5.0, 1.42, '#d8bfa0', 'Quartersawn shows lacy fleck; can warp.', 'Finishes well.', 'Drawer sides, butcher block, furniture.', '', [4, 8], { food: true }),
  S('tupelo', 'Black tupelo', ['tupelo', 'black gum'], 'hardwood', 35, 810, 8.7, 5.1, 1.20, '#ddcdb2', 'Interlocked grain; hard to split.', 'Plain; paints well.', 'Carving decoys, crates, flooring.', '', [4, 7]),
  S('black-walnut', 'Black walnut', ['walnut', 'american walnut'], 'hardwood', 38, 1010, 7.8, 5.5, 1.68, '#6e4b33', 'Works, carves and turns beautifully.', 'Rich under oil; lightens a little with time.', 'Fine furniture, gunstocks, turning, cutting boards.', 'Can irritate skin in some people.', [9, 16], { food: true, coef: [0.00274, 0.0019] }),
  S('yellow-poplar', 'Poplar (yellow-poplar)', ['poplar', 'tulip poplar', 'tulipwood'], 'hardwood', 29, 540, 8.2, 4.6, 1.58, '#d6d1a6', 'Easy to work and cheap; green streaks.', 'The best hardwood for paint; blotches with stain.', 'Painted furniture, drawer sides, secondary wood, trim.', '', [3, 6], { coef: [0.00289, 0.00158] }),
  S('persimmon', 'Persimmon', [], 'hardwood', 52, 2300, 11.2, 7.9, 2.01, '#cdb594', 'Very hard and smooth-wearing.', 'Finishes smoothly.', 'Golf club heads, shuttles, turning.', '', [8, 15]),
  // North American softwoods
  S('eastern-white-pine', 'Eastern white pine', ['white pine', 'pine'], 'softwood', 25, 380, 6.1, 2.1, 1.24, '#e7d3a6', 'Soft, even and easy to work; dents easily.', 'Blotches with stain — use a conditioner or gel stain. Seal knots before paint.', 'Furniture, trim, carving, kids\' projects.', '', [3, 6], { coef: [0.00212, 0.00071] }),
  S('sugar-pine', 'Sugar pine', [], 'softwood', 25, 380, 5.6, 2.9, 1.19, '#eadbb5', 'Very stable and easy to carve.', 'Like white pine.', 'Patterns, mouldings, carving.', '', [5, 9]),
  S('ponderosa-pine', 'Ponderosa pine', [], 'softwood', 28, 460, 6.2, 3.9, 1.29, '#e3cc9c', 'Easy to work; resin pockets.', 'Blotches with stain.', 'Millwork, windows, furniture.', '', [3, 6], { coef: [0.00289, 0.00132] }),
  S('southern-yellow-pine', 'Southern yellow pine', ['yellow pine', 'longleaf pine', 'syp'], 'softwood', 41, 870, 7.5, 5.1, 1.98, '#e0bb7d', 'Hard latewood and soft earlywood; resinous, gums blades.', 'Uneven stain; treated lumber for outdoors.', 'Framing, flooring, workbenches, treated outdoor lumber.', '', [2, 4]),
  S('douglas-fir', 'Douglas-fir', ['fir', 'doug fir'], 'softwood', 33, 660, 7.6, 4.8, 1.95, '#d9a979', 'Strong and stiff; splinters, so keep tools sharp.', 'Uneven stain.', 'Framing, beams, doors, windows, workbenches.', '', [3, 6], { coef: [0.00267, 0.00165] }),
  S('white-fir', 'White fir', ['fir'], 'softwood', 27, 480, 7.0, 3.3, 1.50, '#e6d6b8', 'Easy to work; knotty.', 'Paints well.', 'Framing, crates, mouldings.', '', [2, 4]),
  S('balsam-fir', 'Balsam fir', [], 'softwood', 25, 400, 6.9, 2.9, 1.45, '#e8d8b9', 'Soft, light.', 'Paints well.', 'Framing, crates, pulp.', '', [2, 4]),
  S('eastern-hemlock', 'Eastern hemlock', ['hemlock'], 'softwood', 28, 500, 6.8, 3.0, 1.20, '#d9c09a', 'Splintery; ring shake.', 'Paints well.', 'Framing, sheathing, crates.', '', [2, 4]),
  S('western-hemlock', 'Western hemlock', ['hem-fir'], 'softwood', 29, 540, 7.8, 4.2, 1.63, '#dcc6a3', 'Even and easy to work.', 'Takes stain fairly evenly.', 'Framing, trim, doors.', '', [3, 5]),
  S('western-red-cedar', 'Western red cedar', ['cedar', 'red cedar'], 'softwood', 23, 350, 5.0, 2.4, 1.11, '#b97a57', 'Very soft and light; aromatic.', 'Weathers to silver outdoors; reacts with iron (use stainless fasteners).', 'Outdoor furniture, fences, siding, birdhouses, chests.', 'The dust can cause asthma in some people; wear a good mask.', [4, 8], { outdoor: true, coef: [0.00234, 0.00111] }),
  S('eastern-red-cedar', 'Eastern red cedar (aromatic cedar)', ['aromatic cedar', 'cedar'], 'softwood', 33, 900, 4.7, 3.1, 0.88, '#b05a4a', 'Knotty; strong smell.', 'Usually left unfinished inside chests.', 'Closet lining, chests, fence posts, pencils.', 'Dust can irritate; wear a mask.', [4, 8], { outdoor: true }),
  S('northern-white-cedar', 'Northern white cedar', ['white cedar', 'arborvitae'], 'softwood', 22, 320, 4.9, 2.2, 0.80, '#d9c5a3', 'Very light and soft.', 'Weathers grey.', 'Fences, shingles, canoes, outdoor work.', '', [3, 6], { outdoor: true }),
  S('alaska-yellow-cedar', 'Alaska yellow cedar', ['yellow cedar'], 'softwood', 31, 580, 6.0, 2.8, 1.42, '#e6d39c', 'Fine and even; carves well.', 'Finishes well.', 'Boats, outdoor furniture, carving.', '', [8, 14], { outdoor: true }),
  S('redwood', 'Redwood', [], 'softwood', 26, 480, 4.4, 2.6, 1.34, '#a85a3e', 'Soft, light and stable.', 'Weathers grey; clear sealers keep the colour.', 'Decks, outdoor furniture, siding.', 'Dust can irritate breathing; wear a mask.', [5, 10], { outdoor: true, coef: [0.00205, 0.0012] }),
  S('bald-cypress', 'Cypress', ['bald cypress'], 'softwood', 32, 510, 6.2, 3.8, 1.44, '#d4b48a', 'Easy to work; greasy feel.', 'Weathers well.', 'Outdoor furniture, boats, siding.', '', [4, 8], { outdoor: true }),
  S('sitka-spruce', 'Sitka spruce', ['spruce'], 'softwood', 27, 510, 7.5, 4.3, 1.57, '#eadcc0', 'Light, stiff and strong for its weight.', 'Finishes well.', 'Guitar tops, ladders, boat spars.', '', [6, 15]),
  S('engelmann-spruce', 'Engelmann spruce', ['spruce'], 'softwood', 24, 390, 7.1, 3.8, 1.30, '#ece0c7', 'Light and even.', 'Paints well.', 'Framing (SPF), instrument tops.', '', [3, 6]),
  S('eastern-spruce', 'Eastern spruce', ['spf', 'white spruce', 'red spruce'], 'softwood', 28, 490, 7.8, 3.8, 1.61, '#ebdfc6', 'Easy to work; knotty.', 'Paints well.', 'Framing lumber (SPF), crates.', '', [2, 4]),
  S('western-larch', 'Western larch', ['larch'], 'softwood', 37, 830, 9.1, 4.5, 1.87, '#cf9f6c', 'Strong; resin.', 'Takes finish fairly well.', 'Framing, flooring, outdoor work.', '', [3, 6]),
  S('tamarack', 'Tamarack', ['eastern larch'], 'softwood', 37, 590, 7.4, 3.7, 1.64, '#cf9c6b', 'Strong; can be resinous.', 'Takes finish fairly well.', 'Posts, boat ribs, framing.', '', [3, 6], { outdoor: true }),
  // Imported woods (typical published figures)
  S('genuine-mahogany', 'Genuine mahogany', ['honduran mahogany', 'mahogany', 'swietenia'], 'imported', 37, 800, 4.1, 3.0, 1.50, '#9d553a', 'Very stable; carves and machines beautifully.', 'Fill the pores for a glass finish; darkens nicely.', 'Fine furniture, boats, carving, instruments.', DUST, [12, 22]),
  S('african-mahogany', 'African mahogany', ['khaya'], 'imported', 33, 830, 5.8, 4.1, 1.40, '#a5603f', 'Interlocked grain; can tear out.', 'Like genuine mahogany.', 'Furniture, boats, veneer.', DUST, [8, 14]),
  S('sapele', 'Sapele', [], 'imported', 42, 1410, 7.2, 4.6, 1.76, '#8f4e33', 'Ribbon figure from interlocked grain; tears out when planed against it.', 'Finishes well; striking quartersawn.', 'Furniture, doors, instruments.', DUST, [8, 14]),
  S('teak', 'Teak', [], 'imported', 41, 1070, 5.8, 2.6, 1.78, '#b07f4d', 'Very stable; silica dulls tools quickly; oily.', 'Wipe with solvent before gluing or finishing; weathers silver.', 'Outdoor furniture, boats, cutting boards.', 'Dust can irritate skin and lungs; wear a mask.', [20, 40], { outdoor: true }),
  S('iroko', 'Iroko', [], 'imported', 40, 1260, 3.8, 2.8, 1.35, '#b88a4f', 'Interlocked grain; hard deposits dull tools.', 'Darkens with age.', 'Outdoor furniture, boats, a teak substitute.', 'Dust is a known irritant and can cause asthma; wear a good mask.', [10, 16], { outdoor: true }),
  S('purpleheart', 'Purpleheart', [], 'imported', 56, 2520, 6.1, 3.2, 2.27, '#6e3b5a', 'Very hard; gums and burns with dull tools.', 'Purple fades to brown in sunlight; UV-blocking finish helps.', 'Accents, inlay, cutting boards, turning.', DUST, [10, 18]),
  S('padauk', 'African padauk', ['padauk', 'padouk'], 'imported', 47, 1970, 5.2, 3.3, 1.70, '#b4442a', 'Works well; dust stains everything orange.', 'Bright orange fades to brown.', 'Accents, turning, inlay.', DUST, [10, 18]),
  S('wenge', 'Wenge', [], 'imported', 54, 1630, 9.6, 5.9, 2.48, '#3b2a20', 'Coarse; splinters are sharp and slow to heal.', 'Open grain; oil finishes look best.', 'Accents, flooring, turning.', 'Dust and splinters are irritating; wear gloves and a mask.', [20, 35]),
  S('bubinga', 'Bubinga', [], 'imported', 55, 2410, 8.4, 5.8, 2.48, '#8e4b3a', 'Heavy and hard; figured boards tear out.', 'Finishes to a high lustre.', 'Furniture tops, turning, instruments.', DUST, [20, 40]),
  S('jatoba', 'Jatoba (Brazilian cherry)', ['brazilian cherry'], 'imported', 57, 2690, 8.0, 4.2, 2.75, '#9c4f37', 'Very hard; hard to work.', 'Darkens considerably.', 'Flooring, furniture, tool handles.', DUST, [10, 18]),
  S('ipe', 'Ipe', ['brazilian walnut'], 'imported', 69, 3510, 8.0, 6.6, 3.14, '#6a4a32', 'Extremely hard and heavy; predrill every screw.', 'Oil or leave to weather; very decay-resistant.', 'Decking, outdoor furniture.', 'Dust can irritate badly; wear a good mask.', [10, 18], { outdoor: true }),
  S('spanish-cedar', 'Spanish cedar', ['cedro'], 'imported', 29, 600, 6.3, 4.2, 1.31, '#b97b55', 'Soft and light; can bleed resin.', 'Usually left bare inside humidors.', 'Humidors, cigar boxes, closet lining.', DUST, [8, 14], { outdoor: true }),
  S('european-beech', 'European beech', ['steamed beech'], 'imported', 45, 1450, 11.8, 5.8, 2.01, '#d6a984', 'Even and strong; moves a lot.', 'Finishes smoothly.', 'Workbenches, chairs, tool bodies, toys.', '', [6, 10], { food: true }),
  S('indian-rosewood', 'Indian rosewood', ['east indian rosewood', 'rosewood'], 'imported', 52, 2440, 5.8, 2.7, 1.68, '#5b3427', 'Oily; dulls tools; wipe with solvent before gluing.', 'Beautiful under oil or shellac.', 'Instruments, fine boxes, accents.', 'A strong sensitizer: dust and contact can cause skin and breathing reactions; wear gloves and a good mask.', [25, 50]),
  S('cocobolo', 'Cocobolo', [], 'imported', 69, 2960, 4.3, 2.7, 2.70, '#8e3e26', 'Very oily; dulls tools; wipe with solvent before gluing.', 'Polishes to a shine on its own.', 'Knife handles, pens, small turning.', 'A strong sensitizer: many people react to the dust and oil. Wear gloves and a good mask; stop if you get a rash.', [40, 90])
]

export const speciesById = (id: string) => SPECIES.find(s => s.id === id)

/** The species a wood's species name refers to (by name or other name), if any. */
export function findSpecies(name: string): Species | undefined {
  const n = name.trim().toLowerCase()
  if (!n) return undefined
  return SPECIES.find(s => s.name.toLowerCase() === n || s.id === n) ?? SPECIES.find(s => s.aka.includes(n))
}

/** Stiffness of sheet goods, million psi (along the face grain for plywood). */
export const SHEET_MOE: { match: RegExp; moe: number; label: string }[] = [
  { match: /\bmdf\b/i, moe: 0.4, label: 'MDF' },
  { match: /particle/i, moe: 0.35, label: 'Particleboard' },
  { match: /plywood|\bply\b/i, moe: 1.2, label: 'Plywood' }
]
