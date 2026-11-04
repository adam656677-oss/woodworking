import { expect, test as base, type ElectronApplication, type Page } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs } from './helpers'

const test = base.extend<{ workspace: { app: ElectronApplication; win: Page } }>({
  workspace: async ({}, use) => {
    const session = await launch(newDirs())
    try { await use(session) } finally { kill(session.app) }
  }
})

test('dashboard preserves workshop entry points and backup area', async ({ workspace: { win } }) => {
  await expect(win.getByRole('heading', { name: 'A&A Woodworking Studio' })).toBeVisible()
  await expect(win.getByRole('heading', { name: 'Workshop resources' })).toBeVisible()
  for (const name of ['Master Shop', "Kids' Workshop", 'Finishing School', 'Shop Tools', 'Smart Helpers settings']) {
    await expect(win.getByRole('button', { name, exact: true })).toBeVisible()
  }
  await expect(win.locator('footer')).toBeVisible()
})

test('adult panels collapse, restore, and resize using the keyboard', async ({ workspace: { win } }) => {
  await enterMasterShop(win)
  const parts = win.getByRole('complementary', { name: 'Parts', exact: true })
  const resize = win.getByRole('separator', { name: 'Resize Parts' })
  await expect(resize).toHaveAttribute('aria-valuenow', '240')
  await resize.focus()
  await resize.press('ArrowRight')
  await expect(resize).toHaveAttribute('aria-valuenow', '250')
  await resize.press('Home')
  await expect(resize).toHaveAttribute('aria-valuenow', '200')
  await parts.getByRole('button', { name: 'Collapse Parts' }).click()
  await expect(resize).toBeHidden()
  await parts.getByRole('button', { name: 'Expand Parts' }).click()
  await expect(resize).toBeVisible()
  await expect(resize).toHaveAttribute('aria-valuenow', '200')
})

test('Inspector keyboard navigation and toolbar requests expose their controls', async ({ workspace: { win } }) => {
  await enterMasterShop(win)
  const inspector = win.getByRole('complementary', { name: 'Inspector', exact: true })
  const properties = inspector.getByRole('tab', { name: 'Properties', exact: true })
  await properties.focus()
  await properties.press('ArrowRight')
  await expect(inspector.getByRole('tab', { name: 'Template', exact: true })).toBeFocused()
  await expect(inspector.getByRole('tabpanel')).toContainText('This project has no live template')
  await win.getByRole('button', { name: 'Checks ▾', exact: true }).click()
  await win.getByRole('menuitem', { name: 'Interference', exact: true }).click()
  await expect(inspector.getByRole('tab', { name: 'Checks', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(inspector.getByRole('button', { name: 'Check for interference' })).toBeVisible()
  await inspector.getByRole('tab', { name: 'References', exact: true }).click()
  await expect(inspector.getByRole('region', { name: 'Pictures', exact: true })).toBeVisible()
})

test('command palette searches, executes, and closes with Escape', async ({ workspace: { win } }) => {
  await enterMasterShop(win)
  const shortcut = process.platform === 'darwin' ? 'Meta+k' : 'Control+k'
  await win.keyboard.press(shortcut)
  const palette = win.getByRole('dialog', { name: 'Find a command', exact: true })
  const search = palette.getByRole('combobox', { name: 'Search commands' })
  await expect(search).toBeFocused()
  await search.fill('camera')
  await expect(palette.getByRole('option')).toHaveCount(5)
  await search.fill('no-such-workspace-command')
  await expect(palette.getByRole('status')).toHaveText('No matching commands.')
  await search.fill('reference pictures')
  await search.press('Enter')
  await expect(palette).toBeHidden()
  await expect(win.getByRole('region', { name: 'Pictures', exact: true })).toBeVisible()
  await win.keyboard.press(shortcut)
  await expect(search).toBeFocused()
  await search.press('Escape')
  await expect(palette).toBeHidden()
})

test('command palette does not open above an existing modal', async ({ workspace: { win } }) => {
  await enterMasterShop(win)
  await win.getByRole('button', { name: 'Cut List', exact: true }).click()
  const cuts = win.getByRole('dialog', { name: 'Cut list', exact: true })
  await expect(cuts).toBeVisible()
  await win.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k')
  await expect(win.getByRole('dialog', { name: 'Find a command', exact: true })).toBeHidden()
  await expect(cuts).toBeVisible()
})

test('children do not receive the adult palette or Inspector tabs', async ({ workspace: { win } }) => {
  await win.getByRole('button', { name: "Kids' Workshop", exact: true }).click()
  await win.getByRole('button', { name: 'Simple Designer', exact: true }).click()
  await expect(win.getByRole('button', { name: 'Add board', exact: true })).toBeVisible()
  await expect(win.getByRole('button', { name: /Commands ·/ })).toHaveCount(0)
  await expect(win.getByRole('tablist', { name: 'Inspector sections', exact: true })).toHaveCount(0)
})
