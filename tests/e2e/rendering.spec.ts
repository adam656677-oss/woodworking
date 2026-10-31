import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs, stubSaveDialog } from './helpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }
/** Width and height from a PNG file's header. */
const pngSize = (path: string) => { const b = readFileSync(path); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } }

test('realistic look: wood, finish and light; a 2× picture is saved at twice the view size; rendered views reach the plan packet', async () => {
  const dirs = newDirs()
  const { app, win } = await launch(dirs)
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Bookshelf', exact: true }).click()
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
    // PNG colour type 6 = RGBA.
    expect(readFileSync(clear)[25]).toBe(6)

    // The three views for the packet.
    await dlg.getByRole('button', { name: 'Render views for the plan packet' }).click()
    await expect(dlg.getByRole('status')).toContainText('3 pictures ready', { timeout: 30_000 })
    await expect(dlg.getByAltText('Rendered Exploded')).toBeVisible()
    await dlg.getByRole('button', { name: 'Close' }).click()
    await win.getByRole('button', { name: 'Drawings' }).click()
    await win.getByRole('tab', { name: 'Plan packet' }).click()
    await expect(win.getByRole('checkbox', { name: 'Rendered pictures' })).toBeVisible()
    await win.keyboard.press('Escape')
  } finally {
    kill(app)
  }
})
