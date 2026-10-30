import { expect, test, type Page } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs } from './helpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }) }

test('bookshelf: the layout shows the plywood sheets with numbered cuts; the shopping list totals; labels are ready to print', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Bookshelf', exact: true }).click()
    await win.getByRole('button', { name: 'Cut List' }).click()
    const dlg = win.getByRole('dialog', { name: 'Cut list' })
    await dlg.getByRole('tab', { name: 'Layout' }).click()
    const ply = dlg.getByRole('region', { name: 'Layout for 3/4" Plywood' })
    await expect(ply).toContainText('3/4" Plywood — 1 sheet')
    await expect(ply.getByRole('listitem').first()).toContainText('Rip a strip 10" wide')
    await shot(win, 'layout')
    await dlg.getByRole('tab', { name: 'Buy' }).click()
    await expect(dlg.getByRole('region', { name: 'Shopping list' })).toContainText('3/4" Plywood')
    await shot(win, 'buy')
    await dlg.getByRole('tab', { name: 'Labels' }).click()
    await expect(dlg.getByTestId('label-page')).toHaveCount(1)
    await expect(dlg.getByLabel('QR code')).toHaveCount(8)
    await shot(win, 'labels')
    await expect(dlg.getByRole('button', { name: 'Print labels' })).toBeVisible()
  } finally {
    kill(app)
  }
})
