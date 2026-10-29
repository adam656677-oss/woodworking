import { expect, test, type Page } from '@playwright/test'
import { join } from 'node:path'
import { enterMasterShop, kill, launch, newDirs, part, stubOpenDialog, stubSaveDialog, typeInches, unlockTemplate } from './helpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }

test('bookshelf: explode, section, weight, and a shelf pushed into a side is an interference', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Bookshelf', exact: true }).click()
    await unlockTemplate(win)
    const tools = win.getByRole('toolbar', { name: 'View tools' })
    await tools.getByLabel('Explode').fill('80')
    await shot(win, 'exploded')
    await tools.getByLabel('Explode').fill('0')
    await tools.getByLabel('Section', { exact: true }).selectOption('x')
    await tools.getByLabel('Section position').fill('500')
    await shot(win, 'section')
    await tools.getByLabel('Section', { exact: true }).selectOption('off')
    await tools.getByLabel('Overall size').check()
    await expect(win.getByTestId('overall-h')).toHaveText('36" H')
    await tools.getByLabel('Overall size').uncheck()

    await win.getByRole('button', { name: 'Checks ▾' }).click()
    await win.getByRole('menuitem', { name: 'Weight & balance' }).click()
    await expect(win.getByTestId('total-weight')).toHaveText(/^\d+ lb/)
    await shot(win, 'weight')

    await win.getByRole('button', { name: 'Checks ▾' }).click()
    await win.getByRole('menuitem', { name: 'Interference' }).click()
    const panel = win.getByRole('region', { name: 'Interference' })
    await panel.getByRole('button', { name: 'Check for interference' }).click()
    await expect(panel.getByRole('status')).toHaveText('✓ No parts run into each other.')
    // Type the shelf's X past its dado, so it runs into the left side.
    await part(win, 'Shelf').click()
    const x = await win.getByLabel('X', { exact: true }).inputValue()
    await typeInches(win, 'X', '0')
    const ask = win.getByRole('dialog', { name: 'Replace' })
    if (await ask.isVisible()) await ask.getByRole('button', { name: /^(Replace|Remove the rule)$/ }).click()
    expect(x).not.toBe('0"')
    await panel.getByRole('button', { name: 'Check for interference' }).click()
    await expect(panel.getByRole('list', { name: 'Interferences' })).toContainText(/(Shelf and Side|Side and Shelf) run into each other/)
    await shot(win, 'interference')
  } finally {
    kill(app)
  }
})

test('keep a measured dimension and a note; they come back after save and reopen', async () => {
  const dirs = newDirs()
  const file = join(dirs.docs, 'dims.aaw')
  {
    const { app, win } = await launch(dirs)
    try {
      await enterMasterShop(win)
      await win.getByRole('button', { name: 'Bookshelf', exact: true }).click()
      await unlockTemplate(win)
      await win.getByRole('button', { name: 'Front', exact: true }).click()
      await win.getByRole('button', { name: 'Measure' }).click()
      const box = (await win.getByTestId('scene').boundingBox())!
      await win.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3)
      await win.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.7)
      await win.getByRole('button', { name: 'Keep' }).click()
      await expect(win.getByTestId('dimension-label')).toHaveCount(1)
      await win.getByRole('button', { name: 'Measure' }).click()
      const notes = win.getByRole('region', { name: 'Dimensions & notes' })
      await notes.getByRole('button', { name: 'Add note' }).click()
      await win.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.4)
      await notes.getByLabel('Note text').fill('Glue the back last')
      await notes.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(win.getByTestId('note-label')).toHaveText('📝 Glue the back last')
      await shot(win, 'notes')
      await stubSaveDialog(app, file)
      await win.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(win).toHaveTitle('A&A Woodworking Studio — dims')
      await app.close()
    } catch (e) {
      kill(app)
      throw e
    }
  }
  const { app, win } = await launch(dirs)
  try {
    await enterMasterShop(win)
    await stubOpenDialog(app, file)
    await win.getByRole('button', { name: 'Open', exact: true }).click()
    await expect(win.getByTestId('dimension-label')).toHaveCount(1)
    await expect(win.getByTestId('note-label')).toHaveText('📝 Glue the back last')
  } finally {
    kill(app)
  }
})
