import { expect, test } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs, startTemplate } from './helpers'

test('one click generates a plan from the current design without creating a second model', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await startTemplate(win, 'Box')
    const parts = win.getByRole('list', { name: 'Parts', exact: true })
    const names = await parts.innerText()
    await win.getByRole('button', { name: 'Create Build Plan', exact: true }).click()
    const preview = win.getByRole('dialog', { name: 'Build plan preview', exact: true })
    await expect(preview.getByTestId('build-plan-sheet').first()).toBeVisible({ timeout: 60_000 })
    await expect(preview.getByRole('region', { name: 'Build plan cut list' })).toBeAttached()
    await expect(preview.getByRole('region', { name: 'Build plan assembly guidance' })).toBeAttached()
    await expect(preview.getByRole('button', { name: 'Save as PDF', exact: true })).toBeEnabled()
    await preview.getByRole('button', { name: 'Back to Design', exact: true }).click()
    await expect(preview).toBeHidden()
    expect(await parts.innerText()).toBe(names)
    await expect(win.getByRole('button', { name: 'View Build Plan', exact: true })).toBeVisible()
  } finally { kill(app) }
})
