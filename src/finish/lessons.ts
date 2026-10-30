// Finishing School lessons, written in the app's own words. Times and ratios are typical — follow the can.

export type FinishCard = { title: string; text: string[]; tip?: string }
export type FinishLesson = { id: string; title: string; group: LessonGroup; cards: FinishCard[] }
export type LessonGroup = 'Getting ready' | 'Colour' | 'The finishes' | 'Putting it on' | 'Safety' | 'Touch-up and repair'
export const GROUPS: LessonGroup[] = ['Getting ready', 'Colour', 'The finishes', 'Putting it on', 'Safety', 'Touch-up and repair']

const L = (id: string, title: string, group: LessonGroup, cards: FinishCard[]): FinishLesson => ({ id, title, group, cards })

export const LESSONS: FinishLesson[] = [
  L('prep', 'Surface prep', 'Getting ready', [
    { title: 'The finish shows everything', text: ['A finish magnifies what\'s under it: scratches, glue, dents and machine marks all get darker and easier to see.', 'Most finishing problems are prep problems.'] },
    { title: 'Sanding order', text: ['Start with the grit that removes the worst marks (often 120), then go up without skipping more than one step: 120, 150, 180.', 'Stop at 180 for stains and oils on most woods — finer sanding can make stain look weak. Go to 220 for film finishes on fine-grained woods.'], tip: 'Pencil squiggles across the surface before each grit; when they\'re gone, you\'re done with that grit.' },
    { title: 'Glue and dents', text: ['Dried glue blocks stain and shows as pale spots. Scrape or sand it off; wipe the surface with mineral spirits to see hidden smears.', 'Steam out small dents: a damp cloth and a hot iron swell the crushed fibres back up.'] },
    { title: 'Dust', text: ['Vacuum, then wipe with a tack cloth or a rag damp with mineral spirits (for oil finishes) or water (for water-based).'] }
  ]),
  L('raise-grain', 'Raising the grain', 'Getting ready', [
    { title: 'Why wood gets fuzzy', text: ['Water swells the tiny cut fibres on the surface so they stand up. Water-based stains, dyes and finishes do this on the first coat.'] },
    { title: 'Raise it on purpose', text: ['Wipe the sanded wood with a damp rag, let it dry an hour, then sand lightly with the last grit you used.', 'Now the first water-based coat stays smooth.'] }
  ]),
  L('grain-filling', 'Grain filling', 'Getting ready', [
    { title: 'Open-pored woods', text: ['Oak, ash, mahogany and walnut have open pores that show as tiny pits in a film finish.', 'For a mirror-flat look, fill them; for a natural look, leave them.'] },
    { title: 'Filling', text: ['Seal first with a thin coat of shellac, then rub paste filler across the grain with a pad or plastic card.', 'When it hazes, scrape off across the grain. Let it dry fully (overnight or more) and sand lightly.', 'Several coats of finish sanded back also fill the pores, slowly.'] }
  ]),
  L('sealing', 'Sealers and washcoats', 'Getting ready', [
    { title: 'What a sealer does', text: ['The first coat of any finish seals the wood. A sealer is just a first coat chosen to sand easily, stick to everything, or stop something.'] },
    { title: 'Dewaxed shellac, the universal sealer', text: ['A 1-lb cut of dewaxed shellac sticks to almost anything and almost anything sticks to it.', 'Use it to seal in resin knots, oil and silicone contamination, and to separate finishes that don\'t get along (a barrier coat).'] },
    { title: 'Washcoats for blotchy wood', text: ['Pine, cherry, maple and birch can blotch with stain. A very thin washcoat (a ½-lb cut of shellac or a commercial conditioner) evens out how the stain soaks in.', 'Test on scrap: too much washcoat and the stain barely takes.'] }
  ]),
  L('colourants', 'Dyes, pigment stains and gel stains', 'Colour', [
    { title: 'Pigment', text: ['Pigment is ground colour, like very fine mud. It lodges in pores and scratches, so it darkens the grain and shows sanding marks.', 'Oil-based pigment stains are easy to wipe on and wipe off.'] },
    { title: 'Dye', text: ['Dye dissolves, so it colours the wood fibres themselves — clear, bright colour that doesn\'t hide the figure.', 'Water dyes give the most even colour but raise the grain; alcohol and NGR dyes dry fast and are best sprayed.', 'Dyes fade in strong sun more than pigments.'] },
    { title: 'Gel stain', text: ['A thick pigment stain that sits on the surface: the most even colour on blotchy woods, and it can go over an old finish.'] },
    { title: 'Test first', text: ['Always make a sample board from the same wood, sanded the same way, with the whole schedule on it — colour, sealer and topcoat.', 'The topcoat changes the colour.'], tip: 'Keep your sample boards labelled with the products and steps. They become your colour library.' }
  ]),
  L('glazes-toners', 'Glazes and toners', 'Colour', [
    { title: 'Glaze', text: ['A thick, slow-drying colour put on over a sealer and wiped back. Leaves colour in corners and profiles for depth or an antique look.', 'Always seal over it before the topcoat, and keep it thin.'] },
    { title: 'Toner', text: ['Finish with a little dye or pigment mixed in, sprayed in thin coats. It changes the colour evenly without touching the wood — great for blending a repair or matching a set.', 'Aerosol toners make this possible without a spray gun.'] }
  ]),
  L('colour-matching', 'Colour matching', 'Colour', [
    { title: 'Look in good light', text: ['Match under the light the piece will live in. Daylight and warm LED bulbs make colours look different.'] },
    { title: 'Background, then grain, then overall', text: ['Match the lightest background colour first with a dye or stain. Add the darker grain with a fine brush or a graining pen. Adjust the overall colour with a toner or glaze.'] },
    { title: 'Wet it to see', text: ['Wipe a little mineral spirits on bare wood to see roughly how it will look with a clear finish.'] }
  ]),
  L('oils', 'Oil finishes', 'The finishes', [
    { title: 'Penetrating oils', text: ['Boiled linseed oil, pure tung oil and Danish oil soak in and harden in the wood. They look natural and are easy to renew, but protect little against water and scratches.'] },
    { title: 'How to', text: ['Flood on, wait 15–30 minutes, then wipe off every bit you can. Repeat once a day for a few days, then once a week for a few weeks for a deeper look.'] },
    { title: 'Hardwax oil', text: ['A modern blend that leaves a thin, tougher surface — popular for tables and floors. Very thin coats, buffed off.'] }
  ], ),
  L('wax', 'Wax', 'The finishes', [
    { title: 'What wax is for', text: ['Paste wax gives a soft sheen and a smooth feel and is the last step over another finish.', 'On its own it protects very little.'] },
    { title: 'Nothing sticks to wax', text: ['Before refinishing a waxed piece, scrub the wax off with mineral spirits and #0000 steel wool. Silicone furniture polish is even worse — seal it in with shellac.'] }
  ]),
  L('shellac', 'Shellac', 'The finishes', [
    { title: 'What it is', text: ['A natural resin from the lac bug, dissolved in denatured alcohol. Dries in minutes; each coat melts into the last; easy to repair.', 'Not good against water, alcohol or heat — not for bar tops.'] },
    { title: 'Cuts', text: ['The "cut" is pounds of flakes per gallon of alcohol. A 1-lb cut (2 oz of flakes per pint) seals; a 2-lb cut (4 oz per pint) builds the finish.'] },
    { title: 'Waxed or dewaxed', text: ['Shellac naturally contains wax. Use dewaxed shellac under any other finish; shellac with wax is fine only under more shellac or wax.'] },
    { title: 'Freshness', text: ['Dissolved shellac slowly goes off. Mix from flakes or check the date; old shellac may stay soft.'] }
  ]),
  L('lacquer', 'Nitrocellulose lacquer', 'The finishes', [
    { title: 'The furniture-factory finish', text: ['Dries in minutes, builds fast and rubs out beautifully. Each coat dissolves into the one below, so repairs blend invisibly.'] },
    { title: 'Needs spraying', text: ['Lacquer is sprayed (brushing lacquers exist but are slow and smelly). The fumes are flammable: a spray booth or strong cross-ventilation, an explosion-proof fan and a respirator.'] },
    { title: 'Blush', text: ['On humid days lacquer can turn milky as moisture is trapped. A little retarder thinner in the mix, or a mist of it over the blush, clears it.'] }
  ]),
  L('catalysed', 'Pre-cat and post-cat (conversion varnish)', 'The finishes', [
    { title: 'Catalysed finishes', text: ['A catalyst makes the finish cure chemically into a much harder film. Pre-cat lacquer comes with it mixed in; post-cat (conversion varnish) is mixed just before use.', 'They resist water, alcohol and cleaners far better than nitro — the standard for kitchen cabinets.'] },
    { title: 'Follow the system', text: ['Use the maker\'s sealer and stay within their total thickness limit or the film can crack.', 'Mixed post-cat has a pot life: what\'s left at the end of the day is waste.', 'Repairs are hard to blend, so get it right on the first try.'] }
  ]),
  L('varnish', 'Varnish and polyurethane', 'The finishes', [
    { title: 'Tough films', text: ['Oil-based varnish and polyurethane give the most protection you can brush: water, heat and wear. They amber over time — warm on cherry, yellow over white paint.'] },
    { title: 'Brushing', text: ['Thin the first coat 10–20%. Brush with the grain, tip off with a nearly dry brush, and don\'t go back once it starts to set.', 'Sand with 320 between coats.'] },
    { title: 'Wipe-on poly', text: ['Polyurethane thinned to wipe on with a rag. Thinner coats mean more of them, but almost no runs, sags or brush marks.'] },
    { title: 'Spar varnish', text: ['A softer, flexible varnish with UV blockers for outdoor work. Not for tabletops indoors — it stays too soft.'] }
  ]),
  L('waterborne', 'Water-based finishes', 'The finishes', [
    { title: 'Why choose them', text: ['Low smell, fast drying, soap-and-water cleanup, and they stay clear — no yellowing over white or light woods.'] },
    { title: 'Getting a good result', text: ['Raise the grain first. Use a synthetic brush or pad, or spray. Thin coats; sand with 320 between.', 'They can look cold or grey on dark woods: a coat of dewaxed shellac or a little amber dye underneath warms them up.'] },
    { title: 'Over oil-based stain', text: ['Wait until the stain is completely dry (several days) or put a barrier coat of dewaxed shellac between them.'] }
  ]),
  L('application', 'Wipe, brush or spray', 'Putting it on', [
    { title: 'Wiping', text: ['The easiest: thin finishes on a lint-free rag. Few runs and no brush marks, but more coats.'] },
    { title: 'Brushing', text: ['Natural bristle for oil-based finishes and shellac; synthetic for water-based. Load the brush, lay the finish on, tip off lightly with the grain.'] },
    { title: 'Spraying', text: ['The smoothest and fastest, but it needs a gun (HVLP is easiest), a place to spray, ventilation and a respirator.', 'Hold the gun square to the surface, 6–8 inches away, and overlap each pass by half.'] }
  ]),
  L('sheen', 'Sheen', 'Putting it on', [
    { title: 'Flat to gloss', text: ['Sheen is how much light the surface reflects. Matting agents make flat and satin finishes; gloss has none.'] },
    { title: 'Build in gloss, finish in satin', text: ['Matting agents cloud the finish a little, so many finishers build with gloss and put only the last coat in satin.', 'Stir satin finishes well — the matting agent settles.'] }
  ]),
  L('rubbing-out', 'Rubbing out', 'Putting it on', [
    { title: 'Why rub out', text: ['Rubbing out levels dust nibs and brush marks and sets the sheen exactly where you want it.'] },
    { title: 'How', text: ['Let the finish cure hard (a week or more). Level with 600–1000 grit wet paper on a flat block with soapy water.', 'For satin: #0000 steel wool with wax or soap. For gloss: finer papers, then rubbing compound and polish.'], tip: 'Don\'t rub through the edges — they\'re the thinnest part of the finish.' }
  ]),
  L('times', 'Dry, recoat and cure times', 'Putting it on', [
    { title: 'Three different times', text: ['Dry to touch: dust won\'t stick. Recoat: the next coat can go on. Cure: the finish has reached full hardness and resistance.', 'Cure takes days to weeks — go easy on a new tabletop for the first month.'] },
    { title: 'Weather', text: ['Cold slows everything; humidity slows water-based finishes and lacquer can blush. Most cans assume about 70°F and 50% humidity.'] }
  ]),
  L('food-safe', 'Food safety', 'Safety', [
    { title: 'Cured is safe', text: ['Once fully cured, common finishes are considered safe for food contact. Curing can take a month for oil-based finishes.', 'Mineral oil and board butter are safe from the start.'] },
    { title: 'Cutting boards and spoons', text: ['Use oil (mineral oil or board butter) rather than a film finish — knives cut a film to pieces. Re-oil when the wood looks dry.'] }
  ]),
  L('safety', 'Finishing safety', 'Safety', [
    { title: 'Air', text: ['Work with fresh air moving through. Solvent fumes are heavier than air and collect low.', 'Use a respirator with organic-vapour cartridges for solvent finishes and any spraying; a dust mask does nothing for fumes.'] },
    { title: 'Fire', text: ['Solvent finishes and their fumes are flammable. No pilot lights, heaters or sparks nearby; spray only where fumes are carried away.'] },
    { title: 'Oily rags', text: ['Rags with linseed oil, tung oil, Danish oil, oil-based stain or varnish heat up as they dry and can catch fire by themselves.', 'Lay them flat outside to dry, or put them in a metal can full of water with a lid, then dispose of them as your town allows.'], tip: 'This is the most common finishing fire. Never leave oily rags in a pile.' },
    { title: 'Skin and eyes', text: ['Nitrile gloves and safety glasses, every time. Keep finishes away from children and pets.'] }
  ]),
  L('damage', 'Repair: read the damage', 'Touch-up and repair', [
    { title: 'Where is the damage?', text: ['In the finish only (white rings, light scratches, dull spots)? Through the finish into the colour? Into the wood (dents, gouges, burns)?', 'Repair only as deep as the damage goes.'] },
    { title: 'White rings', text: ['Moisture trapped in the finish. Gentle heat (a hair dryer) or a light rub with a fine abrasive and oil often clears it.'] },
    { title: 'Dark rings', text: ['Water got into the wood. That usually means stripping the area and bleaching with oxalic acid.'] }
  ]),
  L('fillers', 'Repair: fillers and burn-in', 'Touch-up and repair', [
    { title: 'Wax sticks', text: ['Soft, coloured wax sticks (Mohawk Fil-Stik is one) fill nail holes and small scratches in finished wood. Rub in, level with a plastic card, buff.'] },
    { title: 'Burn-in sticks', text: ['Hard resin sticks melted in with a hot knife fill chips and gouges in finished surfaces and can be levelled flush and finished over. Mohawk\'s Hard-Fill and burn-in sticks are made for this.', 'It takes practice: try it on scrap first.'] },
    { title: 'Wood putty', text: ['For bare wood before finishing. Choose one that takes stain, or colour it to match afterwards.'] }
  ]),
  L('colour-repair', 'Repair: colour, graining and sheen', 'Touch-up and repair', [
    { title: 'Colour replacement', text: ['Where colour is worn off, add it back in thin layers: touch-up markers, colour powders mixed with a binder (Mohawk Blendal powders and sticks are one option), or a toner.', 'Go a shade lighter than you think; you can always add more.'] },
    { title: 'Graining', text: ['Paint the darker grain lines back across a fill with a fine brush or a graining pen, following the lines on each side.'] },
    { title: 'Sheen', text: ['Seal the repair with a thin coat of finish, then match the sheen: aerosol finishes in different sheens, or steel wool and wax to dull a shiny spot.'] }
  ]),
  L('care', 'Scratches and care', 'Touch-up and repair', [
    { title: 'Light scratches', text: ['A coloured furniture marker or wax stick hides most fine scratches. A scratch cover polish darkens light scratches on dark wood.'] },
    { title: 'Everyday care', text: ['Dust with a soft, slightly damp cloth. Avoid silicone polishes — they make future refinishing hard.', 'Coasters and pads under hot things, and keep furniture out of strong sun.'] }
  ])
]

export const lessonById = (id: string) => LESSONS.find(l => l.id === id)
