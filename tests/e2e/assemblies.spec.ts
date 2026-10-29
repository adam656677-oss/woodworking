import { expect, test, type Page } from '@playwright/test'
import { cutListRows, enterMasterShop, kill, launch, newDirs, part, startTemplate, typeInches } from './helpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }

async function blankWith(win: Page, names: string[]) {
  await enterMasterShop(win)
  await startTemplate(win, 'Box')
  await win.getByRole('button', { name: 'New ▾' }).click()
  await win.getByRole('menuitem', { name: 'Blank project' }).click()
  for (let i = 0; i < names.length; i++) await win.getByRole('button', { name: 'Add board' }).click()
  for (let i = 0; i < names.length; i++) {
    await part(win, `Board ${i + 1}`).dblclick()
    await win.getByLabel('Part name').fill(names[i])
    await win.getByLabel('Part name').press('Enter')
  }
}

test('group a drawer, make two linked copies, change one part: all three follow; hide and isolate', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await blankWith(win, ['Front', 'Side', 'Bottom'])
    await part(win, 'Front').click()
    await part(win, 'Bottom').click({ modifiers: ['Shift'] })
    await win.getByRole('button', { name: 'Group', exact: true }).click()
    const dialog = win.getByRole('dialog', { name: 'Name the group' })
    await dialog.getByLabel('Group name').fill('Drawer')
    await dialog.getByRole('button', { name: 'Group' }).click()
    const panel = win.getByRole('region', { name: 'Group' })
    await expect(panel.getByLabel('Group name')).toHaveValue('Drawer')

    await panel.getByRole('button', { name: 'Linked copy' }).click()
    await panel.getByRole('button', { name: 'Linked copy' }).click()
    await expect(win.getByRole('button', { name: 'Group Drawer' })).toHaveCount(3)
    await expect(panel).toContainText('Linked — 3 copies stay the same')

    await part(win, 'Front').first().click()
    await typeInches(win, 'Width', '5')
    const rows = await cutListRows(win)
    expect(rows.find(r => r[1] === 'Front')?.slice(0, 4)).toEqual(['3', 'Front', '3/4"', '5"'])
    await shot(win, 'linked-drawers')

    await win.getByRole('button', { name: 'Hide Drawer' }).first().click()
    await expect(win.getByRole('button', { name: 'Show Drawer' })).toHaveCount(1)
    await win.getByRole('button', { name: 'Group Drawer' }).nth(1).click()
    await win.getByRole('button', { name: 'Isolate' }).click()
    await shot(win, 'isolated')
    await win.getByRole('button', { name: 'Show all' }).click()
    await expect(win.getByRole('button', { name: 'Show Drawer' })).toHaveCount(0)
    await expect(win.getByRole('button', { name: 'Show all' })).toBeDisabled()
  } finally {
    kill(app)
  }
})
