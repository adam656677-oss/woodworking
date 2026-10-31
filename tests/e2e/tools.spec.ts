import { readFileSync, writeFileSync } from 'node:fs'
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

test('Shop Tools: the stock list survives the Inventory tab; the timer logs its time; bad minutes are refused; low stock shows on Home; kids get Math Helpers; the journal reaches the packet', async () => {
  const dirs = newDirs()
  const two = [{ id: 's1', woodId: 'ply-3-4', kind: 'offcut', width: 24, length: 30 }, { id: 's2', woodId: 'ply-3-4', kind: 'sheet', width: 48, length: 96 }]
  writeFileSync(join(dirs.userData, 'stock.json'), JSON.stringify(two))
  const { app, win } = await launch(dirs)
  try {
    await win.getByRole('button', { name: 'Shop Tools' }).click()
    await win.getByRole('tab', { name: 'Inventory' }).click()
    await expect(win.getByText('My shop stock (2)')).toBeVisible()
    await win.getByText('My shop stock (2)').click()
    await win.getByRole('button', { name: 'Add to my stock' }).click()
    await expect(win.getByText('My shop stock (3)')).toBeVisible()
    await expect.poll(() => JSON.parse(readFileSync(join(dirs.userData, 'stock.json'), 'utf8')).length).toBe(3)

    // Hardware with a low mark: Home warns.
    await win.getByLabel('Hardware quantity').fill('2')
    await win.getByRole('button', { name: 'Add hardware' }).click()
    await win.getByRole('region', { name: 'Hardware on hand' }).getByLabel(/^Low mark for/).fill('4')
    await expect(win.getByRole('alert').filter({ hasText: 'Running low' })).toBeVisible()

    await win.getByRole('button', { name: '← Back' }).click()
    await expect(win.getByText(/Running low/)).toBeVisible()

    // The timer keeps running across tabs and its minutes land in the box.
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Bookshelf', exact: true }).click()
    await win.clock.install()
    await win.getByRole('button', { name: 'Shop tools' }).click()
    await win.getByRole('tab', { name: 'Shop journal' }).click()
    await win.getByRole('button', { name: 'Start timer' }).click()
    await win.getByRole('tab', { name: 'Calculators' }).click()
    await win.getByRole('tab', { name: 'Shop journal' }).click()
    await expect(win.getByRole('timer', { name: 'Timer' })).toBeVisible()
    await win.clock.fastForward('25:00')
    await win.getByRole('button', { name: 'Stop timer' }).click()
    await expect(win.getByLabel('Minutes')).toHaveValue('25')
    await win.getByLabel('Minutes').fill('-30')
    await expect(win.getByRole('button', { name: 'Add to the journal' })).toBeDisabled()
    await win.getByLabel('Minutes').fill('45')
    await win.getByLabel('Notes').fill('Glued up the case')
    await win.getByRole('button', { name: 'Add to the journal' }).click()
    await expect(win.getByRole('region', { name: 'Totals' })).toContainText('0 h 45 min')
    await win.getByLabel('Log for').selectOption('general')
    await expect(win.getByRole('list', { name: 'Journal entries' })).not.toContainText('Glued up the case')
    await win.getByLabel('Log for').selectOption('project')
    await win.getByRole('button', { name: '← Back' }).click()

    // The journal page in the plan packet.
    await win.getByRole('button', { name: 'Drawings' }).click()
    await win.getByRole('tab', { name: /packet/i }).click()
    await expect(win.getByLabel('Shop journal')).toBeVisible()

    // Kids: Math Helpers.
    await win.keyboard.press('Escape')
    kill(app)
  } catch (e) { kill(app); throw e }
  const again = await launch(dirs)
  try {
    await again.win.getByRole('button', { name: /Kids' Workshop/ }).click()
    await again.win.getByRole('button', { name: 'Math Helpers' }).click()
    await expect(again.win.getByRole('status').first()).toBeVisible()
  } finally {
    kill(again.app)
  }
})
