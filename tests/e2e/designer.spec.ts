import { expect, test } from '@playwright/test'
import { join } from 'node:path'
import {
  cutListRows, enterMasterShop, kill, launch, newDirs, part, startTemplate, stubOpenDialog, stubSaveDialog, typeInches, unlockTemplate
} from './helpers'

test('1. box template: change the width, the cut list follows', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Box', exact: true }).click()
    await typeInches(win, 'Width (outside)', '14')
    const rows = await cutListRows(win)
    expect(rows.find(r => r[1] === 'Front / Back')!.slice(0, 5)).toEqual(['2', 'Front / Back', '3/4"', '6"', '14"'])
  } finally {
    kill(app)
  }
})

test('2. bookshelf: a side and a shelf show their dado; a shallower dado shortens that shelf by 1/16"', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Bookshelf', exact: true }).click()
    await unlockTemplate(win)
    await part(win, 'Side').click()
    await part(win, 'Shelf').click({ modifiers: ['Control'] })
    const panel = win.getByRole('region', { name: 'Joint' })
    await expect(panel).toContainText('Joined with a dado')
    await typeInches(win, 'Dado depth', '3/16')
    const rows = await cutListRows(win)
    const shortened = rows.find(r => r[0] === '1' && r[1] === 'Shelf')
    expect(shortened?.slice(2, 5)).toEqual(['23/32"', '9-25/32"', '29"'])
    expect(rows.find(r => r[1] === 'Top / Bottom / Shelf')?.[0]).toBe('4')
  } finally {
    kill(app)
  }
})

test('3. save, close, reopen: the cut list is identical', async () => {
  const dirs = newDirs()
  const file = join(dirs.docs, 'test.aaw')
  let before: string[][]
  {
    const { app, win } = await launch(dirs)
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Bookshelf', exact: true }).click()
    await stubSaveDialog(app, file)
    await win.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(win).toHaveTitle('A&A Woodworking Studio — test')
    before = await cutListRows(win)
    await app.close() // nothing unsaved, so no prompt
  }
  {
    const { app, win } = await launch(dirs)
    try {
      await enterMasterShop(win)
      await stubOpenDialog(app, file)
      await win.getByRole('button', { name: 'Open', exact: true }).click()
      await expect(win).toHaveTitle('A&A Woodworking Studio — test')
      expect(await cutListRows(win)).toEqual(before)
    } finally {
      kill(app)
    }
  }
})

test('4. autosave: an unsaved edit survives a crash and can be recovered', async () => {
  test.setTimeout(180_000)
  const dirs = newDirs()
  const file = join(dirs.docs, 'crash.aaw')
  {
    const { app, win } = await launch(dirs)
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Box', exact: true }).click()
    await unlockTemplate(win)
    await stubSaveDialog(app, file)
    await win.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(win).toHaveTitle('A&A Woodworking Studio — crash')
    await part(win, 'Front').dblclick()
    await win.getByLabel('Part name').fill('Front Panel')
    await win.getByLabel('Part name').press('Enter')
    await expect(win).toHaveTitle('A&A Woodworking Studio — crash *')
    await win.waitForTimeout(31_000)
    kill(app)
  }
  {
    const { app, win } = await launch(dirs)
    try {
      await enterMasterShop(win)
      await stubOpenDialog(app, file)
      await win.getByRole('button', { name: 'Open', exact: true }).click()
      await win.getByRole('dialog', { name: 'Recover work' }).getByRole('button', { name: 'Recover' }).click()
      await expect(part(win, 'Front Panel')).toBeVisible()
    } finally {
      kill(app)
    }
  }
})

test("5. Kids' Workshop shows coming soon and Back returns Home", async () => {
  const { app, win } = await launch(newDirs())
  try {
    await win.getByRole('button', { name: /Kids' Workshop/ }).click()
    await expect(win.getByText("Coming soon — the Kids' Workshop is being built.")).toBeVisible()
    await win.getByRole('button', { name: 'Back' }).click()
    await expect(win.getByRole('button', { name: /Master Shop/ })).toBeVisible()
  } finally {
    kill(app)
  }
})

test('6. free-form picture frame: four miters give 4 × 3/4 × 2 × 14 with 45° both ends', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await startTemplate(win, 'Box')
    await win.getByRole('button', { name: 'New ▾' }).click()
    await win.getByRole('menuitem', { name: 'Blank project' }).click()

    // [name, length, rotate?, x, y] — rails run left-right, stiles fit between them: 14 × 14 outside.
    const parts: [string, string, boolean, string, string][] = [
      ['Rail', '14', true, '0', '0'],
      ['Rail', '14', true, '0', '12'],
      ['Stile', '10', false, '0', '2'],
      ['Stile', '10', false, '12', '2']
    ]
    for (let i = 0; i < parts.length; i++) {
      await win.getByRole('button', { name: 'Add board' }).click()
    }
    for (let i = 0; i < parts.length; i++) {
      const [name, length, rotate, x, y] = parts[i]
      await part(win, `Board ${i + 1}`).dblclick()
      await win.getByLabel('Part name').fill(name)
      await win.getByLabel('Part name').press('Enter')
      await win.getByRole('list', { name: 'Parts' }).getByRole('listitem').nth(i).click()
      await typeInches(win, 'Width', '2')
      await typeInches(win, 'Length', length)
      if (rotate) {
        await win.getByRole('button', { name: 'Rotate 90° ▾' }).click()
        await win.getByRole('menuitem', { name: 'About Z' }).click()
      }
      await typeInches(win, 'X', x)
      await typeInches(win, 'Y', y)
    }

    const items = win.getByRole('list', { name: 'Parts' }).getByRole('listitem')
    for (const [r, s] of [[0, 2], [0, 3], [1, 2], [1, 3]]) {
      await items.nth(r).click()
      await items.nth(s).click({ modifiers: ['Control'] })
      await win.getByRole('region', { name: 'Joint' }).getByRole('button', { name: 'Miter' }).click()
      await expect(win.getByRole('region', { name: 'Joint' })).toContainText('Joined with a miter')
    }

    const rows = await cutListRows(win)
    expect(rows).toEqual([['4', 'Rail / Stile', '3/4"', '2"', '14"', '1x4', 'length', '45° miter both ends']])
    await expect(win.getByRole('region', { name: 'Warnings' })).toHaveCount(0)
  } finally {
    kill(app)
  }
})

test('7. unsaved work: New asks first; Cancel keeps it. A part turns to a typed angle', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Box', exact: true }).click()
    await unlockTemplate(win)
    await win.getByRole('button', { name: 'New ▾' }).click()
    await win.getByRole('menuitem', { name: 'Blank project' }).click()
    const ask = win.getByRole('dialog', { name: 'Unsaved changes' })
    await expect(ask).toBeVisible()
    await ask.getByRole('button', { name: 'Cancel' }).click()
    await expect(ask).toBeHidden()
    await expect(part(win, 'Front')).toBeVisible()

    await part(win, 'Front').click()
    const turnZ = win.getByLabel('Turn Z°')
    await turnZ.fill('30')
    await turnZ.press('Enter')
    await expect(win.getByLabel('Turn Z°')).toHaveValue('30')
  } finally {
    kill(app)
  }
})
