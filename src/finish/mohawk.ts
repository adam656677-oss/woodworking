// The Mohawk Finishing Products section: who they are, their product families in our own words, and links to
// their own pages (opened in the system browser). A&A Woodworking Studio is not affiliated with Mohawk.

export const MOHAWK_SITE = 'https://www.mohawk-finishing.com/'
export const MOHAWK_NOTE = 'A&A Woodworking Studio is not affiliated with or endorsed by Mohawk Finishing Products. Product names are theirs; descriptions here are ours. Always read the maker\'s data sheet and label.'

export const MOHAWK_ABOUT = [
  'Mohawk Finishing Products is a long-standing American maker of wood finishing and furniture touch-up and repair products, used by furniture makers, cabinet shops, refinishers and repair technicians.',
  'They are best known for touch-up and repair: fill sticks, burn-in sticks, colour sticks and powders, markers and aerosol toners — and for sprayed coatings, stains and sealers for shops.'
]

export type MohawkFamily = { name: string; what: string; use: string; url: string; generic: string }

export const MOHAWK_FAMILIES: MohawkFamily[] = [
  { name: 'Stains (including Ultra® Penetrating stains and Wiping Wood™ stains)', what: 'Dye and pigment stains for spraying or wiping, in a wide range of wood colours.', use: 'Colour step of a schedule; matching new parts to old.', url: 'https://www.mohawk-finishing.com/products/stains/', generic: 'Any dye or oil-based pigment stain' },
  { name: 'Aerosols, toners and Tone Finish®', what: 'Spray cans of clear finish, tinted toners and shading lacquers.', use: 'Adjusting colour evenly, blending a repair, and sealing or topcoating small jobs without a spray gun.', url: 'https://www.mohawk-finishing.com/products/aerosols/', generic: 'Aerosol lacquer and tinted toner' },
  { name: 'Coatings', what: 'Lacquers and other topcoats for spraying, from nitrocellulose to catalysed.', use: 'The topcoat step for shops that spray.', url: 'https://www.mohawk-finishing.com/products/coatings/', generic: 'Nitro, pre-cat or post-cat lacquer' },
  { name: 'Sealers and primers', what: 'First coats made to sand easily and to suit the topcoat above.', use: 'The seal step under lacquers and paint.', url: 'https://www.mohawk-finishing.com/products/sealers-primers/', generic: 'Sanding sealer, dewaxed shellac, primer' },
  { name: 'Fillers (Fil-Stik® putty sticks)', what: 'Soft coloured wax sticks for nail holes and small scratches in finished wood.', use: 'Quick touch-ups that don\'t need a finish over them.', url: 'https://www.mohawk-finishing.com/products/fillers/', generic: 'Coloured wax filler sticks' },
  { name: 'Burn-in sticks (including Hard-Fill)', what: 'Hard resin sticks melted into chips and gouges with a heated knife, then levelled.', use: 'Durable repairs in finished surfaces that can be finished over.', url: 'https://www.mohawk-finishing.com/products/burn-ins/', generic: 'Hard burn-in resin sticks' },
  { name: 'Colour replacement (Blendal® sticks and powders)', what: 'Colour in stick and powder form, blended with a binder and brushed on in thin layers.', use: 'Rebuilding missing colour and grain over a fill.', url: 'https://www.mohawk-finishing.com/products/color-replacement/', generic: 'Touch-up powders or artist\'s pigments in shellac' },
  { name: 'Markers and pencils', what: 'Touch-up and graining markers and pencils in wood colours.', use: 'Hiding scratches and drawing grain lines back across a repair.', url: 'https://www.mohawk-finishing.com/products/markers/', generic: 'Furniture touch-up markers' },
  { name: 'Liquid touch-up', what: 'Brush-on touch-up colours and finishes.', use: 'Small colour and sheen repairs.', url: 'https://www.mohawk-finishing.com/products/liquid-touch-up/', generic: 'Brush-on touch-up' },
  { name: 'Rubbing agents, polishes and waxes', what: 'Compounds and polishes for setting the final sheen, and products for care.', use: 'Rubbing out and everyday care.', url: 'https://www.mohawk-finishing.com/products/rubbing-agents/', generic: 'Rubbing compound, paste wax' }
]

export const MOHAWK_LINKS: { label: string; url: string }[] = [
  { label: 'Products', url: 'https://www.mohawk-finishing.com/products/' },
  { label: 'Document library (technical data sheets)', url: 'https://www.mohawk-finishing.com/resources/document-library/' },
  { label: 'Colour charts', url: 'https://www.mohawk-finishing.com/resources/color-charts/' },
  { label: 'Training workshops', url: 'https://www.mohawk-finishing.com/workshops/' }
]
