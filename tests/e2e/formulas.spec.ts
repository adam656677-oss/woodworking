import { expect, test, type Page } from '@playwright/test'
import { parseInches } from '../../src/model/units'
import { cutListRows, enterMasterShop, kill, launch, newDirs, part, startTemplate, typeInches, unlockTemplate } from './helpers'

const inches = (t: string) => {
  const r = parseInches(t, { allowZero: true })
  if (!r.ok) throw new Error(`not inches: ${t}`)
  return r.value
}
const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }
const sizesTab = (win: Page) => win.getByRole('tab', { name: 'Sizes' }).click()
const partsTab = (win: Page) => win.getByRole('tab', { name: 'Parts' }).click()

async function setSize(win: Page, name: string, value: string) {
  const box = win.getByLabel(`Value of ${name}`, { exact: true })
  await box.fill(value)
  await box.press('Enter')
  await expect(win.getByTestId(`result-${name}`)).not.toHaveText('—')
}
async function addSize(win: Page, name: string, value: string) {
  await win.getByLabel('New size name').fill(name)
  await win.getByLabel('New size value').fill(value)
  await win.getByRole('button', { name: 'Add size' }).click()
  await expect(win.getByLabel(`Value of ${name}`, { exact: true })).toBeVisible()
}
/** Z of each part in the list whose name starts with one of these, by clicking it. */
async function zOf(win: Page, name: string, nth = 0) {
  await part(win, name, nth).click()
  return inches(await win.getByLabel('Z', { exact: true }).inputValue())
}
async function addNamedBoards(win: Page, names: string[]) {
  for (let i = 0; i < names.length; i++) await win.getByRole('button', { name: 'Add board' }).click()
  for (let i = 0; i < names.length; i++) {
    await part(win, `Board ${i + 1}`).dblclick()
    await win.getByLabel('Part name').fill(names[i])
    await win.getByLabel('Part name').press('Enter')
  }
}
async function blankProject(win: Page) {
  await enterMasterShop(win)
  await startTemplate(win, 'Box')
  await win.getByRole('button', { name: 'New ▾' }).click()
  await win.getByRole('menuitem', { name: 'Blank project' }).click()
}

test('1. bookshelf: unlock, H 36 → 48 in Sizes; sides follow, shelves re-space, cut list updates', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Bookshelf', exact: true }).click()
    await unlockTemplate(win)
    await sizesTab(win)
    await expect(win.getByTestId('result-H')).toHaveText('36"')
    await setSize(win, 'H', '48')
    await expect(win.getByTestId('result-H')).toHaveText('48"')
    await shot(win, 'sizes-tab')
    await partsTab(win)

    const rows = await cutListRows(win)
    expect(rows.find(r => r[1] === 'Side')?.[4]).toBe('48"')

    // Bottom, three shelves, top: equal clear gaps.
    const levels = [await zOf(win, 'Bottom'), await zOf(win, 'Shelf', 0), await zOf(win, 'Shelf', 1), await zOf(win, 'Shelf', 2), await zOf(win, 'Top')]
    levels.sort((a, b) => a - b)
    const steps = levels.slice(1).map((z, i) => z - levels[i])
    for (const s of steps) expect(Math.abs(s - steps[0])).toBeLessThanOrEqual(1 / 32)
    expect(levels[4] - levels[0]).toBeGreaterThan(40)
    // The dados moved with them: nothing reports a joint out of line.
    await expect(win.getByRole('region', { name: 'Warnings' })).toHaveCount(0)
  } finally {
    kill(app)
  }
})

test('2. =W/2 in a length follows W; typing a number asks to replace the formula', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await blankProject(win)
    await addNamedBoards(win, ['Rail'])
    await sizesTab(win)
    await addSize(win, 'W', '30')
    await partsTab(win)
    await part(win, 'Rail').click()
    await typeInches(win, 'Length', '=W/2')
    await win.getByLabel('Width', { exact: true }).focus()
    await expect(win.getByLabel('Length', { exact: true })).toHaveValue('15"')
    await expect(win.getByLabel('has a formula')).toBeVisible()
    await shot(win, 'formula-box')

    await sizesTab(win)
    await setSize(win, 'W', '40')
    await partsTab(win)
    await part(win, 'Rail').click()
    await expect(win.getByLabel('Length', { exact: true })).toHaveValue('20"')

    await typeInches(win, 'Length', '12')
    const ask = win.getByRole('dialog', { name: 'Replace' })
    await expect(ask).toContainText('Replace the formula =W/2 with 12"?')
    await shot(win, 'replace-ask')
    await ask.getByRole('button', { name: 'Keep formula' }).click()
    await expect(win.getByLabel('Length', { exact: true })).toHaveValue('=W/2')
    await typeInches(win, 'Length', '12')
    await ask.getByRole('button', { name: 'Replace' }).click()
    await win.getByLabel('Width', { exact: true }).focus()
    await expect(win.getByLabel('Length', { exact: true })).toHaveValue('12"')
    await expect(win.getByLabel('has a formula')).toHaveCount(0)
  } finally {
    kill(app)
  }
})

test('3. a slat count =floor(W/4) adds slats when W grows', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await blankProject(win)
    await addNamedBoards(win, ['Left', 'Right', 'Slat'])
    await sizesTab(win)
    await addSize(win, 'W', '24')
    await partsTab(win)
    await part(win, 'Left').click()
    await typeInches(win, 'X', '0')
    await part(win, 'Right').click()
    await typeInches(win, 'X', '=W')
    await part(win, 'Slat').click()
    await typeInches(win, 'Width', '2')

    await win.getByText('Rules', { exact: true }).first().click()
    await win.getByRole('button', { name: 'Add a rule' }).click()
    const dialog = win.getByRole('dialog', { name: 'Add a rule' })
    await dialog.getByLabel('Rule').selectOption({ label: 'Count from a formula' })
    await dialog.getByLabel('Direction').selectOption({ label: 'Across (X)' })
    await dialog.getByLabel('Between').selectOption({ label: 'Left' })
    await dialog.getByLabel('And', { exact: true }).selectOption({ label: 'Right' })
    await dialog.getByLabel('How many').fill('=floor(W/4)')
    await dialog.getByRole('button', { name: 'Add rule' }).click()

    await expect(part(win, 'Slat', 5)).toBeVisible()
    await expect(win.getByRole('list', { name: 'Parts' }).getByRole('listitem').filter({ hasText: /^(⚠ )?Slat/ })).toHaveCount(6)
    await sizesTab(win)
    await setSize(win, 'W', '40')
    await partsTab(win)
    await expect(win.getByRole('list', { name: 'Parts' }).getByRole('listitem').filter({ hasText: /^(⚠ )?Slat/ })).toHaveCount(10)
    await part(win, 'Slat', 3).click()
    await shot(win, 'count-rule')
    await expect(win.getByRole('region', { name: 'Warnings' })).toHaveCount(0)
    const rows = await cutListRows(win)
    expect(rows.find(r => r[1] === 'Slat')?.[0]).toBe('10')
  } finally {
    kill(app)
  }
})

test('4. a bad formula shows its message and keeps the last good value', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await blankProject(win)
    await addNamedBoards(win, ['Rail'])
    await part(win, 'Rail').click()
    await typeInches(win, 'Length', '20')
    await typeInches(win, 'Length', '=Hight - 2')
    await expect(win.getByRole('alert').filter({ hasText: "Unknown size 'Hight'" }).first()).toBeVisible()
    await expect(win.getByRole('region', { name: 'Warnings' })).toContainText("Unknown size 'Hight'")
    await shot(win, 'bad-formula')
    const rows = await cutListRows(win)
    expect(rows.find(r => r[1] === 'Rail')?.[4]).toBe('20"')
    // A formula that can't be read at all is caught in the box, before it's kept.
    await part(win, 'Rail').click()
    await typeInches(win, 'Width', '=3 +* 2')
    await expect(win.getByRole('alert').filter({ hasText: "Can't read this formula" })).toBeVisible()
  } finally {
    kill(app)
  }
})
