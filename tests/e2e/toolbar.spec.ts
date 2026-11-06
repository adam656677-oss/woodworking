import { expect, test } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs } from './helpers'

test('toolbar is grouped File, Create, Modify, Joinery, Inspect, Output with tooltips and shortcut hints', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    const toolbar = win.getByRole('navigation', { name: 'Toolbar', exact: true })
    const groups = toolbar.getByRole('group')
    await expect(groups).toHaveCount(6)
    for (const [i, name] of ['File', 'Create', 'Modify', 'Joinery', 'Inspect', 'Output'].entries()) {
      await expect(groups.nth(i)).toHaveAttribute('aria-label', name)
    }
    const place = async (name: string, group: string) =>
      expect(toolbar.getByRole('group', { name: group, exact: true }).getByRole('button', { name, exact: true })).toHaveCount(1)
    await place('Save', 'File')
    await place('Add board', 'Create')
    await place('Duplicate', 'Modify')
    await place('Joint designer', 'Joinery')
    await place('Measure', 'Inspect')
    await place('Cut List', 'Output')
    await expect(toolbar.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute('title', 'Save the project (Ctrl+S)')
    await expect(toolbar.getByRole('button', { name: 'Undo', exact: true })).toHaveAttribute('title', 'Undo the last change (Ctrl+Z)')
    await expect(toolbar.getByRole('button', { name: 'Checks ▾', exact: true })).toHaveAttribute('title', /problems/)
    // The workspace bar already goes Home and to My Plans, so the toolbar does not repeat them.
    await expect(toolbar.getByRole('button', { name: /Home/ })).toHaveCount(0)
    await expect(toolbar.getByRole('button', { name: /My Plans/ })).toHaveCount(0)
  } finally { kill(app) }
})

test('the command palette offers toolbar commands under the same names and runs them', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'New ▾' }).click()
    await win.getByRole('menuitem', { name: 'Blank project' }).click()
    const key = process.platform === 'darwin' ? 'Meta+k' : 'Control+k'
    const palette = win.getByRole('dialog', { name: 'Find a command', exact: true })
    const search = palette.getByRole('combobox', { name: 'Search commands' })
    await win.keyboard.press(key)
    await search.fill('mirror')
    await expect(palette.getByRole('option', { name: 'Mirror across X' })).toBeVisible()
    await search.fill('joint')
    await expect(palette.getByRole('option', { name: 'Open joint designer' })).toBeVisible()
    await search.fill('add board')
    await search.press('Enter')
    await expect(palette).toBeHidden()
    await expect(win.getByRole('list', { name: 'Parts' }).getByRole('listitem')).toHaveCount(1)
    // "Go to" screens are in the palette too.
    await win.keyboard.press(key)
    await search.fill('go to dashboard')
    await search.press('Enter')
    await expect(win.getByRole('heading', { name: 'Workshop resources', exact: true })).toBeVisible()
  } finally { kill(app) }
})
