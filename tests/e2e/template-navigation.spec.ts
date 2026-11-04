import { expect, test } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs, part, selectInspectorTab, startTemplate, typeInches, unlockTemplate } from './helpers'

test('template editing and unlocking navigate the visible Inspector controls', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await startTemplate(win, 'Box')
    await expect(win.getByRole('tab', { name: 'Template', exact: true })).toHaveAttribute('aria-selected', 'true')
    await selectInspectorTab(win, 'Properties')
    await typeInches(win, 'Width (outside)', '14')
    await expect(win.getByRole('tab', { name: 'Template', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(win.getByLabel('Width (outside)', { exact: true })).toBeVisible()
    await unlockTemplate(win)
    await expect(win.getByRole('tab', { name: 'Properties', exact: true })).toHaveAttribute('aria-selected', 'true')
    await part(win, 'Front').click()
    await expect(win.getByLabel('Width', { exact: true })).toBeVisible()
  } finally {
    kill(app)
  }
})
