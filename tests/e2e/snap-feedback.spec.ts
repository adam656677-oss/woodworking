import { expect, test, type Page } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs, part, typeInches } from './helpers'
import { clickSheet, sheetBox } from './drawHelpers'

const SHOTS = process.env.AA_SHOTS ?? ''

/** Two 1x4 boards side by side (a 1" gap), seen from above and fitted; returns where the second board's corner is on screen. */
async function twoBoards(win: Page, opts: { raiseSecond?: boolean } = {}) {
  await enterMasterShop(win)
  await win.getByRole('button', { name: 'New ▾' }).click()
  await win.getByRole('menuitem', { name: 'Blank project' }).click()
  await win.getByRole('button', { name: 'Add board' }).click()
  await win.getByRole('button', { name: 'Add board' }).click()
  // Pick each board from the Parts list so the move arrows are sure to be on board 2.
  await part(win, 'Board 1').click()
  await part(win, 'Board 2').click()
  if (opts.raiseSecond) await typeInches(win, 'Z', '2')
  await win.getByRole('button', { name: 'Top', exact: true }).click()
  await win.getByRole('button', { name: 'Fit', exact: true }).click()
  await expect(win.getByRole('button', { name: 'Top', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await win.waitForTimeout(800)
  // Top view is flat, centred on the design (x 0 to 8, y 0 to 12) at min(width, height) / (longest side x 1.4) pixels an inch.
  const box = (await win.getByTestId('viewport').boundingBox())!
  const scale = Math.min(box.width, box.height) / (12 * 1.4)
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2
  const corner = { x: cx + (4.5 - 4) * scale, y: cy + 6 * scale }
  return { scale, corner }
}

async function dragLeft(win: Page, from: { x: number; y: number }, pixels: number, holdAlt = false) {
  // The red X arrow is drawn to the left of the corner when seen from above.
  const grab = { x: from.x - 60, y: from.y }
  await win.mouse.move(grab.x, grab.y)
  await win.mouse.down()
  for (let i = 1; i <= 8; i++) {
    if (holdAlt && i === 4) await win.keyboard.down('Alt')
    await win.mouse.move(grab.x - (pixels * i) / 8, grab.y)
  }
  await win.waitForTimeout(300)
}

test('dragging a board near another shows what it snapped to and lands flush', async () => {
  const { app, win } = await launch(newDirs())
  try {
    const { scale, corner } = await twoBoards(win)
    // Board 2 sits 1" from board 1; pull it to within a few hundredths of an inch of touching.
    await dragLeft(win, corner, scale * 0.93)
    const feedback = win.getByTestId('snap-feedback')
    await expect(win.getByTestId('snap-label')).toHaveText('Corner')
    await expect(win.getByTestId('snap-readout')).toContainText('X -1"')
    await expect(win.getByTestId('snap-readout')).toContainText('with Board 1')
    if (SHOTS) await win.screenshot({ path: `${SHOTS}/snap-corner.png` })
    await win.mouse.up()
    await expect(feedback).toHaveCount(0)
    // Flush: board 2 now starts exactly where board 1 ends (3-1/2").
    await expect(win.getByLabel('X', { exact: true })).toHaveValue('3-1/2"')
  } finally { kill(app) }
})

test('a board lined up on two sides is called an edge, and its position is snapped too', async () => {
  const { app, win } = await launch(newDirs())
  try {
    const { scale, corner } = await twoBoards(win, { raiseSecond: true })
    await dragLeft(win, corner, scale * 0.9)
    await expect(win.getByTestId('snap-label')).toHaveText('Edge')
    if (SHOTS) await win.screenshot({ path: `${SHOTS}/snap-edge.png` })
    await win.mouse.up()
    await expect(win.getByLabel('X', { exact: true })).toHaveValue('3-1/2"')
    await expect(win.getByLabel('Z', { exact: true })).toHaveValue('2"')
  } finally { kill(app) }
})

test('holding Alt while dragging switches snapping off', async () => {
  const { app, win } = await launch(newDirs())
  try {
    const { scale, corner } = await twoBoards(win)
    await dragLeft(win, corner, scale * 0.93, true)
    await expect(win.getByTestId('snap-label')).toHaveText('Snap off')
    if (SHOTS) await win.screenshot({ path: `${SHOTS}/snap-off.png` })
    await win.mouse.up()
    await win.keyboard.up('Alt')
    await expect(win.getByLabel('X', { exact: true })).not.toHaveValue('3-1/2"')
  } finally { kill(app) }
})

test('drawing a line shows snap labels, a level guide, a live size and the rule glyph', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: '✏️ Draw a shape ▾' }).click()
    await win.getByRole('menuitem', { name: 'New drawing' }).click()
    await expect(win.getByTestId('drawing-sheet')).toBeVisible()
    await win.getByRole('button', { name: 'Line', exact: true }).click()
    await clickSheet(win, 200, 300)
    const b = await sheetBox(win)
    // Moving straight across from the start: level, with the length and angle shown.
    await win.mouse.move(b.x + 400, b.y + 300)
    await win.mouse.move(b.x + 420, b.y + 300)
    await expect(win.getByTestId('sketch-snap-label')).toHaveText(/grid$/)
    await expect(win.getByTestId('sketch-align-label')).toContainText('Level')
    await expect(win.getByTestId('sketch-guide')).toHaveCount(1)
    await expect(win.getByTestId('sketch-size')).toContainText('at 0°')
    if (SHOTS) await win.screenshot({ path: `${SHOTS}/sketch-level.png` })
    // Alt turns snapping off for that move.
    await win.keyboard.down('Alt')
    await win.mouse.move(b.x + 430, b.y + 305)
    await expect(win.getByTestId('sketch-snap-label')).toHaveText('Snap off')
    await win.keyboard.up('Alt')
    await win.mouse.move(b.x + 440, b.y + 300)
    await win.mouse.click(b.x + 440, b.y + 300)
    await win.keyboard.press('Escape')
    await win.getByRole('button', { name: 'Line', exact: true }).click()
    // Back on the endpoint of the line just drawn.
    const start = win.locator('circle[data-point]').first()
    const fresh = await sheetBox(win)
    await win.mouse.move(fresh.x + 100, fresh.y + 100)
    await win.mouse.move(fresh.x + Number(await start.getAttribute('cx')) + 4, fresh.y + Number(await start.getAttribute('cy')) + 3)
    await expect(win.getByTestId('sketch-snap-label')).toHaveText('Endpoint')
    // Make the line level with a rule: its glyph appears on the sheet.
    await win.getByRole('button', { name: 'Select', exact: true }).click()
    const line = await sheetBox(win)
    await win.mouse.click(line.x + 320, line.y + Number(await start.getAttribute('cy')))
    await win.getByRole('button', { name: 'Level', exact: true }).click()
    const glyph = win.locator('text[data-rule-kind="horizontal"]')
    await expect(glyph).toHaveCount(1)
    await expect(glyph.locator('title')).toHaveText('Level')
    if (SHOTS) await win.screenshot({ path: `${SHOTS}/sketch-rule-glyph.png` })
  } finally { kill(app) }
})
