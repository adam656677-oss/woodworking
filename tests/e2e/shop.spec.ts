import { expect, test, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { enterMasterShop, kill, launch, newDirs, startTemplate } from './helpers'
import { sheetBox } from './drawHelpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }
// A 1×1 PNG (any picture will do; it is drawn square).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
function picture(dir: string) {
  const f = join(dir, 'chair.png')
  writeFileSync(f, PNG)
  return f
}

test('1. Shop Mode on a bookshelf: step through with the keyboard, tick a step, exit; the tick is kept', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Bookshelf', exact: true }).click()
    await win.getByRole('button', { name: '🪚 Shop Mode' }).click()
    const shop = win.getByRole('dialog', { name: 'Shop Mode' })
    await expect(shop.getByTestId('step-title')).toHaveText('Cut the parts')
    await expect(shop.getByTestId('step-count')).toHaveText(/^Step 1 of \d+$/)
    await shot(win, 'shop-cut')
    await win.keyboard.press('ArrowRight')
    await expect(shop.getByTestId('step-title')).toHaveText(/^Cut the dado in Side$/)
    await expect(shop.getByTestId('step-text')).toContainText('1/4" deep')
    await shop.getByRole('checkbox').check()
    await shot(win, 'shop-dado')
    await win.keyboard.press('PageDown')
    await expect(shop.getByTestId('step-count')).toHaveText(/^Step 3 of/)
    await win.keyboard.press('Escape')
    await expect(shop).toHaveCount(0)
    await win.getByRole('button', { name: '🪚 Shop Mode' }).click()
    await win.keyboard.press('ArrowRight')
    await expect(shop.getByRole('checkbox')).toBeChecked()
    await win.keyboard.press('Escape')
  } finally {
    kill(app)
  }
})

test('2. a reference picture in 3D: add it, scale it from two points', async () => {
  const dirs = newDirs()
  const { app, win } = await launch(dirs)
  try {
    await enterMasterShop(win)
    await startTemplate(win, 'Box')
    await win.getByRole('button', { name: 'New ▾' }).click()
    await win.getByRole('menuitem', { name: 'Blank project' }).click()
    await win.getByRole('button', { name: '🖼 Pictures' }).click()
    const panel = win.getByRole('region', { name: 'Pictures' })
    await panel.getByLabel('Add picture').setInputFiles(picture(dirs.docs))
    const row = panel.getByRole('listitem', { name: 'Picture chair' })
    await expect(row).toContainText('24" × 24"')
    await win.getByRole('button', { name: 'Front', exact: true }).click()
    await row.getByRole('button', { name: 'Scale from two points' }).click()
    // Front view of an empty design looks at the middle of a 24" cube: the picture's middle row is the canvas's middle.
    const c = (await win.getByTestId('scene').boundingBox())!
    const zoom = Math.min(c.width, c.height) / (24 * 1.4)
    // The view may still be settling on a slow machine: click again until the point is taken.
    await expect(async () => {
      await win.mouse.click(c.x + c.width / 2 - 6 * zoom, c.y + c.height / 2)
      await expect(row.getByRole('status')).toContainText('the second point', { timeout: 500 })
    }).toPass({ timeout: 10_000 })
    await win.mouse.click(c.x + c.width / 2 + 6 * zoom, c.y + c.height / 2)
    await row.getByLabel('Real distance').fill('36')
    await row.getByRole('button', { name: 'Scale', exact: true }).click()
    // Clicked by pixel, so within a fraction of an inch of 72".
    await expect(row).toContainText(/(71\.[5-9]\d*|72(\.[0-4]\d*)?)" × /)
    await shot(win, 'reference-3d')
  } finally {
    kill(app)
  }
})

test('3. a tracing picture on the drawing board: add it and scale it from two points', async () => {
  const dirs = newDirs()
  const { app, win } = await launch(dirs)
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: '✏️ Draw a shape ▾' }).click()
    await win.getByRole('menuitem', { name: 'New drawing' }).click()
    await expect(win.getByTestId('drawing-sheet')).toBeVisible()
    await win.getByRole('button', { name: '🖼 Tracing picture' }).click()
    const panel = win.getByRole('region', { name: 'Tracing picture' })
    await panel.getByLabel('Add tracing picture').setInputFiles(picture(dirs.docs))
    const img = win.getByTestId('tracing-picture')
    await expect(img).toBeVisible()
    await expect(panel).toContainText('24" × 24"')
    await panel.getByRole('button', { name: 'Scale from two points' }).click()
    const b = await sheetBox(win)
    const [x, y, w, h] = await Promise.all(['x', 'y', 'width', 'height'].map(async a => Number(await img.getAttribute(a))))
    await win.mouse.click(b.x + x + w * 0.25, b.y + y + h / 2)
    await win.mouse.click(b.x + x + w * 0.75, b.y + y + h / 2)
    await panel.getByLabel('Real distance').fill('6')
    await panel.getByRole('button', { name: 'Scale', exact: true }).click()
    await expect(panel).toContainText('12" × 12"')
    await shot(win, 'tracing')
  } finally {
    kill(app)
  }
})
