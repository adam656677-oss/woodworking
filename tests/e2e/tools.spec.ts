import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs } from './helpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }

test('Shop Tools: every calculator answers; a journal entry with a photo; hinges on hand shrink the shopping list', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await win.getByRole('button', { name: 'Shop Tools' }).click()
    const answers: Record<string, string> = {
      'Board feet': 'Board feet', 'Tape math & fractions': 'Answer', 'Even spacing': 'Spacing', 'Compound miter & crown': 'Compound miter',
      'Drawer sizing': 'Drawer boxes', 'Proportions': 'Proportions', 'Shellac': 'Mix shellac', 'Epoxy pour': 'Epoxy'
    }
    for (const [calc, status] of Object.entries(answers)) {
      await win.getByRole('list', { name: 'Calculators' }).getByRole('button', { name: calc }).click()
      await expect(win.getByRole('status', { name: status })).toBeVisible()
    }
    await win.getByRole('list', { name: 'Calculators' }).getByRole('button', { name: 'Compound miter & crown' }).click()
    await expect(win.getByRole('status', { name: 'Crown' })).toContainText('miter 31.6°, bevel 33.9°')
    await shot(win, 'tools-miter')
    await win.getByRole('button', { name: '← Back' }).click()

    // A bookshelf with a pair of doors: then the journal and the inventory.
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Bookshelf', exact: true }).click()
    await win.getByRole('button', { name: 'Shop tools' }).click()
    await win.getByRole('tab', { name: 'Shop journal' }).click()
    await win.getByLabel('Notes').fill('Cut the sides and dadoes')
    await win.getByLabel('Minutes').fill('90')
    await win.getByLabel('Photo').setInputFiles(join(process.cwd(), 'tests/plans/fixtures/photo-page.jpg'))
    await expect(win.getByAltText('New photo 1')).toBeVisible()
    await win.getByRole('button', { name: 'Add to the journal' }).click()
    await expect(win.getByRole('list', { name: 'Journal entries' })).toContainText('Cut the sides and dadoes')
    await expect(win.getByRole('region', { name: 'Totals' })).toContainText('1 h 30 min')
    await shot(win, 'tools-journal')

    await win.getByRole('tab', { name: 'Inventory' }).click()
    await win.getByLabel('Finish product').selectOption({ label: 'Shellac (dewaxed)' })
    await win.getByRole('button', { name: 'Add finish' }).click()
    await expect(win.getByRole('region', { name: 'Finishes on hand' })).toContainText('Shellac (dewaxed)')
    await win.getByRole('button', { name: '← Back' }).click()
    await win.getByRole('button', { name: 'Finish', exact: true }).click()
    await win.getByRole('button', { name: /^Shellac/ }).click()
    await win.getByRole('button', { name: '← Back' }).click()
    await win.getByRole('button', { name: 'Cut List' }).click()
    await win.getByRole('tab', { name: 'Buy' }).click()
    await expect(win.getByRole('region', { name: 'Shopping list' })).toContainText("you have some — check there's enough")
  } finally {
    kill(app)
  }
})
