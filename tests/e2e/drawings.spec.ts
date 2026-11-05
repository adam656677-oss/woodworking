import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs } from './helpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }

test('drawings: views, part sheets, a template and the extras tab; each saved as a PDF at the right page size', async () => {
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

    // Templates print on portrait letter, true size.
    const boxesOf = async (name: string) => {
      const out = join(dirs.docs, name)
      await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = (async () => ({ canceled: false, filePath: path })) as never }, out)
      await dlg.getByRole('button', { name: 'Save as PDF' }).click()
      await expect(dlg).toContainText('Saved', { timeout: 60_000 })
      const pdf = readFileSync(out).toString('latin1')
      return [...pdf.matchAll(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/g)].map(m => [Math.round(+m[1]), Math.round(+m[2])])
    }
    const portrait = await boxesOf('templates.pdf')
    expect(portrait.length).toBeGreaterThan(1)
    expect(portrait.every(([w, h]) => w === 612 && h === 792)).toBe(true)

    // The old plan packet is now Create Build Plan; the extras tab keeps what it does not cover.
    await expect(dlg.getByRole('tab', { name: 'Plan packet' })).toHaveCount(0)
    await dlg.getByRole('tab', { name: 'Extras' }).click()
    await expect(dlg).toContainText('Nothing extra to print yet')

    // Drawing views print on landscape letter.
    await dlg.getByRole('tab', { name: 'Views' }).click()
    await expect(pages).toHaveCount(3, { timeout: 30_000 })
    const landscape = await boxesOf('views.pdf')
    expect(landscape.length).toBeGreaterThan(0)
    expect(landscape.every(([w, h]) => w === 792 && h === 612)).toBe(true)
    await dlg.getByRole('button', { name: 'Close' }).click()
    await expect(dlg).toHaveCount(0)
  } finally {
    kill(app)
  }
})
