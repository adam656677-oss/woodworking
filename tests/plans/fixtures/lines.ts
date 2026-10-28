import type { TextLine } from '../../../src/plans/types'

let y = 0
const L = (text: string, extra: Partial<TextLine> = {}): TextLine => ({ text, page: 1, box: [50, (y += 20), 400, 14], ...extra })

/** A plan as text lines, the way a PDF or OCR hands them over. */
export const STOOL: TextLine[] = [
  L('woodworking plans · page 1', { size: 9 }),
  L('Simple Step Stool', { size: 28 }),
  L('A sturdy stool for the kitchen.', { size: 11 }),
  L('Tools', { size: 16 }),
  L('Cordless drill, jig saw, tape measure', { size: 11 }),
  L('Materials', { size: 16 }),
  L('1-1/4" pocket screws (24)'),
  L('Wood glue'),
  L('Cut List', { size: 16 }),
  L('2 - 3/4 x 11-1/4 x 9" Sides'),
  L('(2) 1x4 @ 14-1/2" Aprons'),
  L('Top: 3/4" x 11-1/4" x 16"'),
  L('1 Stretcher 3/4 x 3 1/2 x 14 1/2'),
  L('2) 1x6 @ 14-1/2" Steps'),
  L('2-3/4x11-1/4% 9" Legs'),
  L('1 - 450mm x 3/4 x 5-1/2 Shelf'),
  L('Instructions', { size: 16 }),
  L('1. Cut all parts to length.'),
  L('2) Cut a V notch in the bottom of each side,'),
  L('about 2" deep.'),
  L('Step 3 Drill pocket holes in the aprons.'),
  L('Step 4: Attach the aprons to the sides'),
  L('with glue and screws.'),
  L('6. Sand smooth and finish.')
]

export const TABLE: TextLine[] = [
  L('Bookcase', { size: 24, page: 1 }),
  L('Qty   Part   T   W   L'),
  L('2   Side   3/4   11-1/4   36'),
  L('3   Shelf   3/4   11-1/4   28-1/2'),
  L('1   Back   1/4   29-1/4   36'),
  L('Instructions')
]

export const UNCERTAIN: TextLine[] = [
  L('Box', { size: 20 }),
  L('2 - 3/4 x 5-1/2 x 2?" Sides', { uncertain: ['2?"'] })
]
