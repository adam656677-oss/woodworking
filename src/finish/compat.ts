// Can one finish go over another? Yes, with a barrier coat between, or no — always with the reason.
import { finishById, type Finish } from './finishes'

export type Answer = { answer: 'yes' | 'barrier' | 'no'; why: string; barrier?: string; wait?: string }

const yes = (why: string, wait?: string): Answer => ({ answer: 'yes', why, ...(wait ? { wait } : {}) })
const no = (why: string): Answer => ({ answer: 'no', why })
const barrier = (why: string, with_ = 'a thin coat of dewaxed shellac'): Answer => ({ answer: 'barrier', why, barrier: with_ })

/** Can `top` go over `under` (once `under` is dry)? */
export function canGoOver(topId: string, underId: string): Answer {
  const top = finishById(topId), under = finishById(underId)
  if (!top || !under) return no('Unknown finish')
  return rule(top, under)
}

function rule(top: Finish, under: Finish): Answer {
  const dry = `once the ${under.name.toLowerCase()} is dry (about ${Math.ceil(under.recoat)} hours${under.recoat >= 12 ? ' or overnight' : ''})`
  // Nothing grips a surface that never dries, or wax.
  if (under.base === 'non-drying') return top.base === 'non-drying' || top.id === 'board-butter' ? yes('More oil (or board butter) is the only thing that goes over mineral oil.') : no('Mineral oil never dries, so nothing can stick to it.')
  if (under.base === 'wax') return top.base === 'wax' ? yes('Wax over wax is fine — buff each coat.') : no('Nothing sticks to wax except more wax. Strip it off with mineral spirits and start fresh.')
  if (top.base === 'wax') return yes('Wax goes over any cured finish for a soft sheen and a smooth feel.', `once the ${under.name.toLowerCase()} has cured`)
  if (top.id === under.id) return yes('More coats of the same finish are fine.', dry)
  // Hardwax oils are meant to be the last coat.
  if (under.id === 'hardwax') return top.base === 'oil' && top.role !== 'topcoat' ? no('Hardwax oil seals the surface; colour won\'t take over it.') : no('Hardwax oil is meant to be the last coat — film finishes don\'t bond to it well. Renew it with more hardwax oil.')
  // Shellac: the universal sealer — goes over anything dry (except the above), and almost anything goes over it.
  if (top.base === 'shellac') return yes('Dewaxed shellac sticks to almost any dry finish or colour; that\'s why it\'s the go-to sealer and barrier coat.', dry)
  if (under.base === 'shellac') {
    if (top.base === 'catalysed') return no('Shellac can crack or let go under catalysed finishes. Use the maker\'s own sealer instead.')
    return yes('Almost any finish goes over dewaxed shellac. (Shellac with wax in it: only shellac or wax over it.)', 'after an hour or two and a light sanding')
  }
  // Colour coats and fillers under finishes.
  if (under.role === 'colour' || under.role === 'filler') {
    if (under.base === 'dye-water' || under.base === 'dye-solvent') {
      if (top.base === 'water') return yes('Fine once the dye is dry. Spray or wipe the first coat lightly — brushing can lift water-soluble dye and smear it.', dry)
      return yes('Any finish goes over dye once it\'s dry.', dry)
    }
    // Oil-based colour (pigment stain, gel stain, glaze, grain filler).
    if (top.role === 'colour') {
      if (top.base === 'oil' && under.base === 'oil') return top.id === 'glaze' ? barrier('Glaze goes over a sealer, not straight over stain, or it can\'t be wiped back evenly.') : yes('Another oil-based colour can go on once the first is dry.', dry)
      return yes('Colour over dry colour is fine; seal between if they might mix.', dry)
    }
    if (top.base === 'water') return barrier('Water-based finishes can fail to bond over oil-based stain, glaze or filler that isn\'t fully cured. A barrier coat makes it safe (or wait at least 72 hours and test).')
    if (top.base === 'lacquer') return yes('Lacquer goes over oil-based colour only when the colour is completely dry — otherwise it can lift or wrinkle.', 'when the colour is completely dry — at least 24 hours, longer in cool weather')
    if (top.base === 'catalysed') return top.id === 'postcat' ? barrier('Conversion varnish wants its own system; seal oil-based colour with the maker\'s vinyl sealer first.', 'the maker\'s vinyl sealer') : yes('Pre-cat lacquer goes over fully dry oil-based colour.', 'when the colour is completely dry (24 hours or more)')
    return yes('Oil-based finishes go over dry oil-based colour.', dry)
  }
  // Film finishes over oils.
  if (under.base === 'oil' || under.base === 'oil-varnish') {
    if (top.base === 'varnish' || top.base === 'oil-varnish' || top.base === 'oil') return yes('Varnish goes over an oil finish once the oil has cured.', 'after the oil has cured — at least 3 days, a week is safer')
    if (top.base === 'water' || top.base === 'paint-latex') return barrier('Water-based coatings may peel off oil. Seal the oil with dewaxed shellac first.')
    if (top.base === 'lacquer') return barrier('Lacquer over oil can stay soft or wrinkle; a shellac barrier coat after the oil cures is safer.')
    return no('Catalysed finishes don\'t go over oil finishes.')
  }
  // Over oil-based varnish / polyurethane.
  if (under.base === 'varnish') {
    if (top.base === 'lacquer' || top.base === 'catalysed') return no('Lacquer solvents attack varnish and polyurethane — it wrinkles and lifts.')
    if (top.base === 'oil' || top.base === 'oil-varnish') return no('An oil finish can\'t soak into a varnish film; it just sits on top and stays tacky.')
    return yes('Fine after a light sanding (320 grit) so it has something to grip.', 'after the varnish has cured and been scuff-sanded')
  }
  // Over water-based finishes and paint.
  if (under.base === 'water' || under.base === 'paint-latex') {
    if (top.base === 'lacquer' || top.base === 'catalysed') return no('Solvent lacquers can soften and wrinkle water-based finishes and latex paint.')
    if (top.base === 'oil' || top.base === 'oil-varnish') return no('Oils can\'t soak in through a water-based film.')
    if (top.base === 'varnish' && under.base === 'paint-latex') return yes('Oil-based varnish goes over cured latex paint after a scuff, but it will yellow white and light colours.', 'after the paint has cured (a week or more)')
    return yes('Fine after a light scuff-sanding.', `once the ${under.name.toLowerCase()} has dried and been scuff-sanded`)
  }
  // Over lacquers.
  if (under.base === 'lacquer') {
    if (under.id === 'sanding-sealer' && (top.base === 'varnish' || top.base === 'catalysed')) return no('Lacquer sanding sealer is too soft under polyurethane or conversion varnish; it can make the whole finish fail.')
    if (top.base === 'lacquer') return yes('Lacquer melts into the coat below — that\'s how it builds and repairs so well.', dry)
    if (top.base === 'catalysed') return top.id === 'postcat' ? no('Conversion varnish over nitro lacquer can lift or crack it.') : yes('Pre-cat over nitro is usually fine; check the maker\'s sheet.', dry)
    if (top.base === 'oil' || top.base === 'oil-varnish') return no('Oils can\'t soak in through lacquer.')
    return yes('Fine after a scuff-sanding.', `once the ${under.name.toLowerCase()} is dry and scuff-sanded`)
  }
  // Over catalysed finishes: only themselves or a scuffed recoat.
  if (under.base === 'catalysed') {
    if (top.base === 'catalysed') return yes('Recoat within the maker\'s window, or scuff-sand first.', dry)
    if (top.base === 'oil' || top.base === 'oil-varnish') return no('Oils can\'t soak in through a catalysed film.')
    return yes('Possible after a thorough scuff-sanding, but the hard film gives it little to grip — test first.', 'after a full cure and scuff-sanding')
  }
  return yes('Fine once the coat below is dry.', dry)
}

/** Every pair worth knowing about, for the checker's examples. */
export const EXAMPLES: [string, string][] = [['oil-poly', 'blo'], ['water-poly', 'oil-stain'], ['nitro', 'oil-poly'], ['shellac', 'paste-wax'], ['nitro', 'oil-stain'], ['water-poly', 'shellac']]
