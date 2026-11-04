import { expect, test } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs, startTemplate } from './helpers'

test('capture actual dashboard, designer, plan preview and shopping screens', async ({}, testInfo) => {
  const { app, win } = await launch(newDirs())
  try {
    const capture = async (name: string) => {
      const path = testInfo.outputPath(`${name}.png`)
      await win.screenshot({ path, animations: 'disabled' })
      await testInfo.attach(name, { path, contentType: 'image/png' })
    }
    await expect(win.getByRole('button', { name: /Master Shop/ })).toBeVisible()
    await capture('dashboard')
    await enterMasterShop(win)
    await startTemplate(win, 'Box')
    await expect(win.getByRole('list', { name: 'Parts', exact: true })).toBeVisible()
    await capture('designer')
    await win.getByRole('button', { name: 'Create Build Plan', exact: true }).click()
    const preview = win.getByRole('dialog', { name: 'Build plan preview' })
    await expect(preview.getByTestId('build-plan-sheet').first()).toBeVisible({ timeout: 60000 })
    await capture('build-plan-preview')
    const shopping = preview.getByRole('region', { name: 'Build plan shopping list' })
    await shopping.scrollIntoViewIfNeeded()
    await expect(shopping).toBeVisible()
    await capture('shopping-preview')
    const path = testInfo.outputPath('shopping-section.png')
    await shopping.screenshot({ path, animations: 'disabled' })
    await testInfo.attach('complete shopping section', { path, contentType: 'image/png' })
  } finally { kill(app) }
})
