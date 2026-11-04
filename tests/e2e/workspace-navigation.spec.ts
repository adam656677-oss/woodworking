import { expect, test } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs } from './helpers'

test('workspace destinations do not shadow resource actions and menus retain keyboard behavior', async () => {
  const { app, win } = await launch(newDirs())
  try {
    const workspace = win.getByRole('navigation', { name: 'Workspace', exact: true })
    const shop = workspace.getByRole('link', { name: 'Shop Tools', exact: true })
    await expect(shop).toHaveCount(1)
    await expect(win.getByRole('button', { name: 'Shop Tools', exact: true })).toHaveCount(1)
    await shop.focus()
    await shop.press('Enter')
    await expect(workspace.getByRole('link', { name: 'Shop Tools', exact: true })).toHaveAttribute('aria-current', 'page')
    await workspace.getByRole('link', { name: 'Dashboard', exact: true }).click()
    await expect(win.getByRole('heading', { name: 'Workshop resources', exact: true })).toBeVisible()
    await enterMasterShop(win)
    await expect(win.getByRole('button', { name: 'Library', exact: true })).toHaveCount(1)
    await expect(workspace.getByRole('link', { name: 'Library', exact: true })).toHaveCount(1)
    const toolbar = win.getByRole('navigation', { name: 'Toolbar', exact: true })
    for (const name of ['New ▾', 'Checks ▾']) {
      const trigger = toolbar.getByRole('button', { name, exact: true })
      await trigger.focus()
      await trigger.press('ArrowDown')
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')
      await expect(toolbar.getByRole('menuitem').first()).toBeFocused()
      await win.keyboard.press('End')
      await expect(toolbar.getByRole('menuitem').last()).toBeFocused()
      await win.keyboard.press('Escape')
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
      await expect(trigger).toBeFocused()
    }
  } finally { kill(app) }
})
