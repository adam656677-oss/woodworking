import { expect, test, type Page } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs } from './helpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }

test('Finishing School: a waterborne schedule for the bookshelf shows in Shop Mode and the printable extras', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Bookshelf', exact: true }).click()
    await win.getByRole('button', { name: 'Finish', exact: true }).click()
    await expect(win.getByRole('heading', { name: 'Finishing School' })).toBeVisible()
    await win.getByRole('button', { name: /^Waterborne/ }).click()
    const steps = win.getByRole('list', { name: 'Finishing steps' })
    await expect(steps.getByRole('listitem')).toHaveCount(4)
    await expect(win.getByText(/About .* of coats and drying/)).toBeVisible()
    await shot(win, 'finish-schedule')
    await win.getByRole('tab', { name: 'Lessons' }).click()
    await win.getByRole('button', { name: 'Finishing safety' }).click()
    await expect(win.getByRole('article', { name: 'Finishing safety' })).toContainText('Oily rags')
    await win.getByRole('tab', { name: 'Mohawk products' }).click()
    await expect(win.getByText(/not affiliated/)).toBeVisible()
    await shot(win, 'finish-mohawk')
    await win.getByRole('button', { name: '← Back' }).click()

    await win.getByRole('button', { name: '🪚 Shop Mode' }).click()
    const shop = win.getByRole('dialog', { name: 'Shop Mode' })
    await expect(shop.getByTestId('step-count')).toHaveText(/^Step 1 of \d+$/)
    const total = Number((await shop.getByTestId('step-count').textContent())!.match(/of (\d+)/)![1])
    for (let i = 1; i < total; i++) await win.keyboard.press('ArrowRight')
    await expect(shop.getByTestId('step-title')).toHaveText(/^Finish: Brush on water-based polyurethane/)
    await win.keyboard.press('Escape')

    await win.getByRole('button', { name: 'Drawings' }).click()
    const dlg = win.getByRole('dialog', { name: 'Drawings' })
    await dlg.getByRole('tab', { name: 'Extras' }).click()
    await expect(dlg).toContainText('Finishing schedule — Bookshelf', { timeout: 30_000 })
  } finally {
    kill(app)
  }
})
