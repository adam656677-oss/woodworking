import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs } from './helpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }

test('drawings: views, part sheets, a template and the plan packet saved as a PDF with landscape and portrait pages', async () => {
  const dirs = newDirs()
  const { app, win } = await launch(dirs)
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Bookshelf', exact: true }).click()
    await win.getByRole('button', { name: 'Drawings' }).click()
    const dlg = win.getByRole('dialog', { name: 'Drawings' })
    const pages = dlg.getByTestId('drawing-page')
    await expect(pages).toHaveCount(3, { timeout: 30_000 })
    await expect(pages.first()).toContainText('FRONT')
    await expect(pages.first()).toContainText('1 of 3')
    await shot(win, 'drawings-views')

    await dlg.getByRole('tab', { name: 'Part sheets' }).click()
    await expect(pages).toHaveCount(3, { timeout: 30_000 })
    await expect(pages.nth(1)).toContainText('P2 Side')
    await dlg.getByRole('button', { name: 'None' }).click()
    await dlg.getByLabel('P2 Side').check()
    await expect(pages).toHaveCount(1)

    await dlg.getByRole('tab', { name: 'Templates' }).click()
    await expect(dlg).toContainText('Pick the parts')
    await dlg.getByLabel('P1 Back').check()
    await expect(pages.first()).toContainText('Full-size template')
    await expect(pages.nth(1)).toContainText('page A1')
    await shot(win, 'drawings-template')

    await dlg.getByRole('tab', { name: 'Plan packet' }).click()
    await expect(pages.first()).toContainText('Plan packet', { timeout: 30_000 })
    await expect(dlg).toContainText('Shopping list — Bookshelf')
    await expect(dlg).toContainText('Steps — Bookshelf')
    const n = await pages.count()
    expect(n).toBeGreaterThan(8)
    // The first sheet after the cover is numbered 2 of the packet's sheets.
    await expect(pages.nth(1)).toContainText(/2 of \d+/)

    const out = join(dirs.docs, 'packet.pdf')
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = (async () => ({ canceled: false, filePath: path })) as never }, out)
    await dlg.getByRole('button', { name: 'Save as PDF' }).click()
    await expect(dlg).toContainText('Saved', { timeout: 60_000 })
    const pdf = readFileSync(out).toString('latin1')
    const boxes = [...pdf.matchAll(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/g)].map(m => [Math.round(+m[1]), Math.round(+m[2])])
    // Letter landscape sheets (792 × 612 points) and letter portrait pages (612 × 792).
    expect(boxes.some(([w, h]) => w === 792 && h === 612)).toBe(true)
    expect(boxes.some(([w, h]) => w === 612 && h === 792)).toBe(true)
    await dlg.getByRole('button', { name: 'Close' }).click()
    await expect(dlg).toHaveCount(0)
  } finally {
    kill(app)
  }
})
