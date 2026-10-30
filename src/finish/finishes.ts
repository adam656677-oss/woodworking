// Finish data: what each kind of finish is like. Times are typical at about 70°F and 50% humidity —
// always follow the can. Ratings are 1 (poor) to 5 (excellent).

export type Method = 'wipe' | 'brush' | 'spray'
export type Role = 'topcoat' | 'colour' | 'sealer' | 'filler'
/** What the finish is made with; it decides most of what it can go over and under. */
export type Base = 'oil' | 'oil-varnish' | 'varnish' | 'water' | 'shellac' | 'lacquer' | 'catalysed' | 'wax' | 'non-drying' | 'dye-water' | 'dye-solvent' | 'paint-latex'

export type Finish = {
  id: string
  name: string
  role: Role
  base: Base
  /** Plain description in a sentence or two. */
  about: string
  durability: number
  water: number
  heat: number
  solvent: number
  repair: number
  ease: number
  /** Safe for food contact: always, once fully cured, or not for food surfaces. */
  food: 'yes' | 'cured' | 'no'
  methods: Method[]
  /** Hours until dry to the touch, and until it can be recoated. */
  touch: number
  recoat: number
  /** Days to full cure (hardness and food safety). */
  cure: number
  sheens: string[]
  /** Smell and solvent: 1 (barely any) to 5 (strong — ventilate well). */
  smell: number
  voc: 'low' | 'medium' | 'high'
  /** Ambers or yellows the wood (and white paint) over time. */
  ambers: boolean
  flammable: boolean
  /** Oily rags can heat up and catch fire by themselves. */
  rags: boolean
  /** Coats usually needed. */
  coats: number
  tips: string[]
}

const F = (f: Finish) => f

export const FINISHES: Finish[] = [
  F({ id: 'blo', name: 'Boiled linseed oil', role: 'topcoat', base: 'oil', about: 'A penetrating oil that soaks in and hardens in the wood. Warms the colour; very little protection on its own.',
    durability: 1, water: 1, heat: 2, solvent: 1, repair: 5, ease: 5, food: 'cured', methods: ['wipe'], touch: 12, recoat: 24, cure: 30, sheens: ['Satin'], smell: 2, voc: 'medium', ambers: true, flammable: true, rags: true, coats: 3,
    tips: ['Flood it on, wait 15 minutes, then wipe off every bit you can. What stays on the surface turns gummy.', 'Lay oily rags flat outside to dry, or put them in a sealed can of water.'] }),
  F({ id: 'tung', name: 'Pure tung oil', role: 'topcoat', base: 'oil', about: 'A penetrating oil that cures a little harder and more water-resistant than linseed. Slow; needs many thin coats.',
    durability: 2, water: 2, heat: 2, solvent: 1, repair: 5, ease: 4, food: 'cured', methods: ['wipe'], touch: 24, recoat: 48, cure: 30, sheens: ['Satin'], smell: 2, voc: 'low', ambers: true, flammable: true, rags: true, coats: 5,
    tips: ['Thin the first coat about half with mineral spirits so it soaks in.', 'Many "tung oil finishes" are really thinned varnish — read the label.'] }),
  F({ id: 'danish', name: 'Danish oil (oil and varnish blend)', role: 'topcoat', base: 'oil-varnish', about: 'Oil mixed with a little varnish. Easy to wipe on, looks "in the wood", a bit more protection than oil alone.',
    durability: 2, water: 2, heat: 2, solvent: 2, repair: 5, ease: 5, food: 'cured', methods: ['wipe'], touch: 8, recoat: 12, cure: 21, sheens: ['Satin'], smell: 3, voc: 'high', ambers: true, flammable: true, rags: true, coats: 3,
    tips: ['Wet-sand the second coat with 400 grit to fill the pores with slurry.', 'Wipe off all the excess after 15–30 minutes.'] }),
  F({ id: 'hardwax', name: 'Hardwax oil', role: 'topcoat', base: 'oil', about: 'Oils and waxes that soak in and leave a thin, tough, natural-looking surface. Easy to spot-repair.',
    durability: 3, water: 3, heat: 3, solvent: 2, repair: 5, ease: 4, food: 'cured', methods: ['wipe', 'brush'], touch: 8, recoat: 12, cure: 14, sheens: ['Matte', 'Satin'], smell: 2, voc: 'low', ambers: false, flammable: true, rags: true, coats: 2,
    tips: ['Apply very thin and buff the excess off.', 'Most makers say not to put a film finish over it.'] }),
  F({ id: 'mineral-oil', name: 'Mineral oil', role: 'topcoat', base: 'non-drying', about: 'Food-grade oil that never dries. Keeps cutting boards and spoons from drying out; renew it often.',
    durability: 1, water: 1, heat: 1, solvent: 1, repair: 5, ease: 5, food: 'yes', methods: ['wipe'], touch: 1, recoat: 1, cure: 0, sheens: ['Satin'], smell: 1, voc: 'low', ambers: false, flammable: false, rags: false, coats: 2,
    tips: ['Re-oil whenever the wood looks dry.', 'Nothing will stick over it.'] }),
  F({ id: 'board-butter', name: 'Board butter (oil and beeswax)', role: 'topcoat', base: 'wax', about: 'Mineral oil thickened with beeswax. A soft, food-safe sheen for cutting boards and utensils.',
    durability: 1, water: 2, heat: 1, solvent: 1, repair: 5, ease: 5, food: 'yes', methods: ['wipe'], touch: 1, recoat: 1, cure: 0, sheens: ['Satin'], smell: 1, voc: 'low', ambers: false, flammable: false, rags: false, coats: 1,
    tips: ['Rub in, leave a few hours, buff off.'] }),
  F({ id: 'paste-wax', name: 'Paste wax', role: 'topcoat', base: 'wax', about: 'A soft sheen and a smooth feel. Little protection on its own; best as the last touch over another finish.',
    durability: 1, water: 2, heat: 1, solvent: 1, repair: 5, ease: 5, food: 'cured', methods: ['wipe'], touch: 0.5, recoat: 1, cure: 1, sheens: ['Satin', 'Semi-gloss'], smell: 2, voc: 'medium', ambers: false, flammable: true, rags: false, coats: 1,
    tips: ['Apply thin with #0000 steel wool or a pad, let haze, then buff.', 'Nothing sticks over wax except more wax — remove it with mineral spirits first.'] }),
  F({ id: 'shellac', name: 'Shellac (dewaxed)', role: 'sealer', base: 'shellac', about: 'A natural resin dissolved in alcohol. Dries in minutes, seals almost anything, sticks to almost anything; not very water- or heat-resistant.',
    durability: 2, water: 2, heat: 1, solvent: 1, repair: 5, ease: 4, food: 'cured', methods: ['wipe', 'brush', 'spray'], touch: 0.5, recoat: 1, cure: 3, sheens: ['Satin', 'Gloss'], smell: 3, voc: 'high', ambers: true, flammable: true, rags: false, coats: 3,
    tips: ['A 1-lb cut is the universal sealer and barrier coat.', 'Use dewaxed shellac under anything else; shellac with wax in it is only for shellac or wax on top.', 'Buy fresh or mix your own from flakes; old shellac may never dry hard.'] }),
  F({ id: 'nitro', name: 'Nitrocellulose lacquer', role: 'topcoat', base: 'lacquer', about: 'The classic sprayed furniture finish. Dries in minutes, rubs out beautifully, each coat melts into the last so repairs blend.',
    durability: 3, water: 3, heat: 2, solvent: 1, repair: 5, ease: 2, food: 'cured', methods: ['spray'], touch: 0.25, recoat: 1, cure: 21, sheens: ['Flat', 'Satin', 'Semi-gloss', 'Gloss'], smell: 5, voc: 'high', ambers: true, flammable: true, rags: false, coats: 4,
    tips: ['Spray only with real ventilation, an explosion-proof fan and a respirator — the fumes are flammable.', 'Brushing lacquer exists but is still strong-smelling.', 'Do not spray it over oil-based varnish or polyurethane; its solvents wrinkle them.'] }),
  F({ id: 'precat', name: 'Pre-catalysed lacquer', role: 'topcoat', base: 'catalysed', about: 'Lacquer with the hardener already mixed in: tougher than nitro, still sprays like lacquer. Common for cabinets.',
    durability: 4, water: 4, heat: 3, solvent: 3, repair: 3, ease: 2, food: 'cured', methods: ['spray'], touch: 0.25, recoat: 1, cure: 14, sheens: ['Flat', 'Satin', 'Semi-gloss', 'Gloss'], smell: 5, voc: 'high', ambers: false, flammable: true, rags: false, coats: 3,
    tips: ['Watch the maker\'s limit on total film thickness — too much can crack.', 'Use the same maker\'s sealer under it.'] }),
  F({ id: 'postcat', name: 'Conversion varnish (post-catalysed)', role: 'topcoat', base: 'catalysed', about: 'A two-part finish mixed with a catalyst just before spraying. Very hard and chemical-resistant — the kitchen cabinet standard.',
    durability: 5, water: 5, heat: 4, solvent: 5, repair: 2, ease: 1, food: 'cured', methods: ['spray'], touch: 0.5, recoat: 2, cure: 14, sheens: ['Flat', 'Satin', 'Semi-gloss', 'Gloss'], smell: 5, voc: 'high', ambers: false, flammable: true, rags: false, coats: 2,
    tips: ['Mixed finish has a pot life: use it the same day.', 'Repairs are hard to blend — get it right the first time.', 'Many give off formaldehyde as they cure; wear a respirator and ventilate.'] }),
  F({ id: 'oil-poly', name: 'Oil-based polyurethane', role: 'topcoat', base: 'varnish', about: 'A tough brushing varnish that resists water, heat and wear. Ambers over time; slow to dry, so dust is the enemy.',
    durability: 5, water: 5, heat: 4, solvent: 4, repair: 2, ease: 3, food: 'cured', methods: ['brush', 'wipe'], touch: 6, recoat: 12, cure: 30, sheens: ['Satin', 'Semi-gloss', 'Gloss'], smell: 4, voc: 'high', ambers: true, flammable: true, rags: true, coats: 3,
    tips: ['Thin the first coat 10–20% as a sealer.', 'Sand with 320 between coats so the next one sticks.'] }),
  F({ id: 'wipe-poly', name: 'Wipe-on polyurethane', role: 'topcoat', base: 'varnish', about: 'Polyurethane thinned to wipe on with a rag. Thin coats, few runs, easy to get a good result; needs more coats.',
    durability: 4, water: 4, heat: 3, solvent: 3, repair: 3, ease: 5, food: 'cured', methods: ['wipe'], touch: 3, recoat: 4, cure: 30, sheens: ['Satin', 'Gloss'], smell: 4, voc: 'high', ambers: true, flammable: true, rags: true, coats: 4,
    tips: ['Wipe on, don\'t scrub back and forth; wipe in the direction of the grain.'] }),
  F({ id: 'spar', name: 'Spar (exterior) varnish', role: 'topcoat', base: 'varnish', about: 'A softer, flexible varnish with UV blockers, for things that live outdoors.',
    durability: 4, water: 5, heat: 3, solvent: 3, repair: 3, ease: 3, food: 'no', methods: ['brush'], touch: 8, recoat: 24, cure: 30, sheens: ['Satin', 'Gloss'], smell: 4, voc: 'high', ambers: true, flammable: true, rags: true, coats: 4,
    tips: ['Outdoors needs at least 4 coats and a fresh coat every year or two.'] }),
  F({ id: 'water-poly', name: 'Water-based polyurethane', role: 'topcoat', base: 'water', about: 'Low smell, dries fast, stays clear (doesn\'t yellow), cleans up with water. A little less heat- and solvent-resistant than oil-based.',
    durability: 4, water: 4, heat: 3, solvent: 3, repair: 3, ease: 4, food: 'cured', methods: ['brush', 'wipe', 'spray'], touch: 1, recoat: 2, cure: 21, sheens: ['Matte', 'Satin', 'Semi-gloss', 'Gloss'], smell: 1, voc: 'low', ambers: false, flammable: false, rags: false, coats: 3,
    tips: ['It looks cold on dark woods — a coat of dewaxed shellac first warms it up.', 'Raise the grain with a damp rag and sand before the first coat.', 'Use synthetic brushes and keep it from freezing.'] }),
  F({ id: 'water-lacquer', name: 'Waterborne lacquer', role: 'topcoat', base: 'water', about: 'A sprayable water-based finish that dries fast and stays clear, without lacquer\'s fumes.',
    durability: 4, water: 4, heat: 3, solvent: 3, repair: 3, ease: 3, food: 'cured', methods: ['spray'], touch: 0.5, recoat: 1, cure: 14, sheens: ['Flat', 'Satin', 'Gloss'], smell: 1, voc: 'low', ambers: false, flammable: false, rags: false, coats: 3,
    tips: ['Spray thin coats; heavy coats can blush or stay soft.'] }),
  F({ id: 'oil-stain', name: 'Oil-based pigment stain', role: 'colour', base: 'oil', about: 'Coloured pigment in oil. Lodges in pores and scratches, so it shows grain and blotches on pine, cherry and maple.',
    durability: 0, water: 0, heat: 0, solvent: 0, repair: 4, ease: 5, food: 'no', methods: ['wipe', 'brush'], touch: 4, recoat: 8, cure: 3, sheens: [], smell: 3, voc: 'high', ambers: false, flammable: true, rags: true, coats: 1,
    tips: ['Use a pre-stain conditioner or a washcoat on blotch-prone woods.', 'Stir often — the pigment settles.', 'Let it dry fully (overnight or more) before any topcoat, longer before water-based.'] }),
  F({ id: 'gel-stain', name: 'Gel stain', role: 'colour', base: 'oil', about: 'A thick, wipe-on stain that sits on the surface. Even colour on blotchy woods; can even go over an old finish.',
    durability: 0, water: 0, heat: 0, solvent: 0, repair: 4, ease: 5, food: 'no', methods: ['wipe'], touch: 8, recoat: 24, cure: 3, sheens: [], smell: 3, voc: 'high', ambers: false, flammable: true, rags: true, coats: 1,
    tips: ['Wipe off evenly; work one area at a time.', 'Give it a full day to dry before a topcoat.'] }),
  F({ id: 'water-dye', name: 'Water-soluble dye', role: 'colour', base: 'dye-water', about: 'Dye powder mixed in water. Clear, bright colour that goes into the wood rather than sitting in pores; fades in strong sun.',
    durability: 0, water: 0, heat: 0, solvent: 0, repair: 3, ease: 3, food: 'no', methods: ['wipe', 'brush', 'spray'], touch: 1, recoat: 2, cure: 1, sheens: [], smell: 1, voc: 'low', ambers: false, flammable: false, rags: false, coats: 1,
    tips: ['Raise the grain and sand first — the dye will raise it again otherwise.', 'Flood it on and wipe evenly to avoid lap marks.'] }),
  F({ id: 'solvent-dye', name: 'Alcohol or NGR dye', role: 'colour', base: 'dye-solvent', about: 'Dye in alcohol or a non-grain-raising solvent. Dries very fast; best sprayed. Also used to tint shellac and lacquer as a toner.',
    durability: 0, water: 0, heat: 0, solvent: 0, repair: 4, ease: 2, food: 'no', methods: ['spray', 'wipe'], touch: 0.25, recoat: 0.5, cure: 1, sheens: [], smell: 4, voc: 'high', ambers: false, flammable: true, rags: false, coats: 1,
    tips: ['Spray light, even coats; wiping fast-drying dye leaves laps.'] }),
  F({ id: 'glaze', name: 'Glaze', role: 'colour', base: 'oil', about: 'A thick, slow-drying colour used between sealer and topcoat to add depth, antique corners or even out colour.',
    durability: 0, water: 0, heat: 0, solvent: 0, repair: 4, ease: 3, food: 'no', methods: ['wipe', 'brush'], touch: 6, recoat: 12, cure: 2, sheens: [], smell: 3, voc: 'high', ambers: false, flammable: true, rags: true, coats: 1,
    tips: ['Always over a sealer, never on bare wood.', 'Keep it thin — thick glaze weakens the topcoat\'s grip.'] }),
  F({ id: 'grain-filler', name: 'Grain filler (oil-based)', role: 'filler', base: 'oil', about: 'A paste that fills the open pores of oak, mahogany and walnut for a glass-smooth finish.',
    durability: 0, water: 0, heat: 0, solvent: 0, repair: 2, ease: 2, food: 'no', methods: ['wipe'], touch: 8, recoat: 24, cure: 2, sheens: [], smell: 3, voc: 'high', ambers: false, flammable: true, rags: true, coats: 1,
    tips: ['Pack it across the grain, then scrape off across the grain when it hazes.', 'A tinted filler darker than the wood makes the pores stand out.'] }),
  F({ id: 'sanding-sealer', name: 'Lacquer sanding sealer', role: 'sealer', base: 'lacquer', about: 'A soft, easy-sanding first coat under lacquer. Builds fast and sands to a fine powder.',
    durability: 1, water: 1, heat: 1, solvent: 1, repair: 4, ease: 3, food: 'no', methods: ['spray'], touch: 0.25, recoat: 0.5, cure: 1, sheens: [], smell: 5, voc: 'high', ambers: true, flammable: true, rags: false, coats: 1,
    tips: ['One coat only — too much makes the whole finish soft.', 'Not under polyurethane or conversion varnish.'] }),
  F({ id: 'latex-paint', name: 'Water-based (latex/acrylic) paint', role: 'topcoat', base: 'paint-latex', about: 'Opaque colour; easy to brush or spray. Use a primer underneath and enamel for doors and tops that get handled.',
    durability: 3, water: 3, heat: 3, solvent: 2, repair: 4, ease: 4, food: 'no', methods: ['brush', 'spray'], touch: 1, recoat: 4, cure: 21, sheens: ['Flat', 'Satin', 'Semi-gloss', 'Gloss'], smell: 1, voc: 'low', ambers: false, flammable: false, rags: false, coats: 2,
    tips: ['Prime first; a shellac-based primer stops knots and tannins bleeding through.', 'Paint stays soft for weeks — don\'t stack doors or put things on shelves too soon.'] })
]

export const finishById = (id: string) => FINISHES.find(f => f.id === id)
export const TOPCOATS = FINISHES.filter(f => f.role === 'topcoat' || f.id === 'shellac')

/** A time in hours as words: "30 min", "8 hours", "2 days". */
export function hoursText(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 48) return `${Number(h.toFixed(1))} hour${h === 1 ? '' : 's'}`
  return `${Number((h / 24).toFixed(1))} days`
}

/** Shellac cuts: pounds of flakes per gallon of alcohol, and the same per pint (a small batch). */
export const SHELLAC_CUTS = [
  { cut: 1, perGallon: '1 lb', perPint: '2 oz', use: 'Sealer, washcoat, barrier coat, French polishing' },
  { cut: 2, perGallon: '2 lb', perPint: '4 oz', use: 'Brushing finish coats' },
  { cut: 3, perGallon: '3 lb', perPint: '6 oz', use: 'Building fast (harder to brush smoothly)' }
]
