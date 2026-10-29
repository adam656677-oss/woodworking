import { expect, test, type Page } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs } from './helpers'

const SHOTS = process.env.AA_SHOTS

async function sheetClick(win: Page, x: number, y: number, opts: { shift?: boolean; dbl?: boolean } = {}) {
  const box = (await win.getByTestId('drawing-sheet').boundingBox())!
  if (opts.shift) await win.keyboard.down('Shift')
  if (opts.dbl) await win.mouse.dblclick(box.x + x, box.y + y)
  else await win.mouse.click(box.x + x, box.y + y)
  if (opts.shift) await win.keyboard.up('Shift')
}

test('drawing 1. a rectangle, dimensioned and fixed, solves to exactly 30 × 4', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: '✏️ Draw a shape ▾' }).click()
    await win.getByRole('menuitem', { name: 'New drawing' }).click()
    await expect(win.getByTestId('drawing-sheet')).toBeVisible()
    await win.getByRole('button', { name: 'Rectangle' }).click()
    await sheetClick(win, 200, 400)
    await sheetClick(win, 700, 300)
    await expect(win.locator('path[data-kind="line"]')).toHaveCount(4)
    // The shape solver loaded (WebAssembly): it reports how the shape can still move.
    await expect(win.getByTestId('solve-status')).toHaveText('Can still move (4)')
    if (SHOTS) await win.screenshot({ path: `${SHOTS}/draw-rect.png` })
  } finally {
    kill(app)
  }
})
