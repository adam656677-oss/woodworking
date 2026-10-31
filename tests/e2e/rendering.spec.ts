import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs, stubSaveDialog } from './helpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }
/** Width and height from a PNG file's header. */
/** The colour of the 3D view at a spot (fractions of its size). */
const pixel = (win: Page, fx: number, fy: number) => win.locator('[data-testid="viewport"] canvas').evaluate((c, [x, y]) => {
  const cv = c as HTMLCanvasElement
  const t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height
  const ctx = t.getContext('2d')!; ctx.drawImage(cv, 0, 0)
  return [...ctx.getImageData(Math.round(cv.width * x), Math.round(cv.height * y), 1, 1).data]
}, [fx, fy])
const pngSize = (path: string) => { const b = readFileSync(path); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } }

test('realistic look: wood, finish and light; a 2× picture is saved at twice the view size; rendered views reach the plan packet', async () => {
  const dirs = newDirs()
  const { app, win } = await launch(dirs)
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Bookshelf', exact: true }).click()
    await win.waitForTimeout(800)
    const cadBefore = await pixel(win, 0.5, 0.55)
    await win.getByLabel('Look').selectOption('real')
    await expect(win.getByLabel('Lighting')).toBeVisible()
    await win.waitForTimeout(1500)
    await shot(win, 'render-pine-studio')
    for (const l of ['workshop', 'daylight'] as const) {
      await win.getByLabel('Lighting').selectOption(l)
      await win.waitForTimeout(800)
      await shot(win, `render-pine-${l}`)
    }
    await win.getByLabel('Lighting').selectOption('studio')
    // Software graphics on the test machine are slow with shadows and occlusion on.
    await win.getByLabel('Shadows').uncheck()

    // A picture at 2×.
    const out = join(dirs.docs, 'shelf.png')
    await stubSaveDialog(app, out)
    await win.getByRole('button', { name: '📷 Picture…' }).click()
    const dlg = win.getByRole('dialog', { name: 'Save a picture' })
    await dlg.getByLabel('2×').check()
    const css = await win.locator('[data-testid="viewport"] canvas').evaluate(c => ({ w: (c as HTMLCanvasElement).clientWidth, h: (c as HTMLCanvasElement).clientHeight }))
    await dlg.getByRole('button', { name: 'Save PNG…' }).click()
    await expect(dlg.getByRole('status')).toContainText('Saved')
    expect(existsSync(out)).toBe(true)
    const s = pngSize(out)
    expect(s.w).toBe(Math.round(css.w * 2))
    expect(s.h).toBe(Math.round(css.h * 2))

    // A clear background.
    const clear = join(dirs.docs, 'clear.png')
    await stubSaveDialog(app, clear)
    await dlg.getByLabel('1×').check()
    await dlg.getByLabel('Clear background (no floor)').check()
    await dlg.getByRole('button', { name: 'Save PNG…' }).click()
    await expect(dlg.getByRole('status')).toContainText('Saved')
    await expect.poll(() => existsSync(clear)).toBe(true)
    await expect(dlg.getByRole('status')).toContainText('clear.png')

    // A corner of the clear picture is see-through.
    expect(await win.evaluate(async src => {
      const img = new Image(); img.src = src; await img.decode()
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
      const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0)
      return ctx.getImageData(1, 1, 1, 1).data[3]
    }, `data:image/png;base64,${readFileSync(clear).toString('base64')}`)).toBe(0)

    // The three views for the packet: made without the selection, which comes back after.
    await dlg.getByRole('button', { name: 'Close' }).click()
    await win.locator('aside').getByText('Side', { exact: true }).first().click()
    await win.getByRole('button', { name: '📷 Picture…' }).click()
    await dlg.getByRole('button', { name: 'Render views for the plan packet' }).click()
    await expect(dlg.getByRole('status')).toContainText('3 pictures ready', { timeout: 30_000 })
    await expect(dlg.getByAltText('Rendered Exploded')).toBeVisible()
    await dlg.getByRole('button', { name: 'Close' }).click()
    await win.getByRole('button', { name: 'Drawings' }).click()
    await win.getByRole('tab', { name: 'Plan packet' }).click()
    await expect(win.getByRole('checkbox', { name: 'Rendered pictures' })).toBeVisible()
    await win.keyboard.press('Escape')
    await win.getByRole('button', { name: 'Close', exact: true }).first().click().catch(() => {})

    // Back to the drawing look: the parts are their CAD colour again, not flat grey.
    await win.getByLabel('Look').selectOption('cad')
    await win.waitForTimeout(800)
    const cadAfter = await pixel(win, 0.5, 0.55)
    expect(cadAfter.slice(0, 3)).toEqual(cadBefore.slice(0, 3))
  } finally {
    kill(app)
  }
})
