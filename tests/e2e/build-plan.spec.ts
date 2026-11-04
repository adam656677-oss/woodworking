import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { enterMasterShop, kill, launch, newDirs, startTemplate, stubSaveDialog } from './helpers'

test('generates one captured packet and exports a real PDF without changing the design', async () => {
  const dirs = newDirs()
  const { app, win } = await launch(dirs)
  try {
    await enterMasterShop(win)
    await startTemplate(win, 'Box')
    const parts = win.getByRole('list', { name: 'Parts', exact: true })
    const names = await parts.innerText()
    await win.getByRole('button', { name: 'Create Build Plan', exact: true }).click()
    const preview = win.getByRole('dialog', { name: 'Build plan preview', exact: true })
    await expect(preview.getByTestId('build-plan-sheet').first()).toBeVisible({ timeout: 60_000 })
    await expect(preview.getByRole('region', { name: 'Build plan cut list' })).toBeAttached()
    const shopping = preview.getByRole('region', { name: 'Build plan shopping list' })
    await expect(shopping).toBeAttached()
    await expect(shopping).toContainText('Captured with shop inventory deductions.')
    await expect(shopping.getByTestId('build-plan-shopping-total')).toHaveText(/^\$[\d,]+\.\d{2}$/)
    await expect(preview.getByRole('region', { name: 'Build plan assembly guidance' })).toBeAttached()
    const pdf = join(dirs.docs, 'build-plan.pdf')
    await stubSaveDialog(app, pdf)
    await preview.getByRole('button', { name: 'Save as PDF', exact: true }).click()
    await expect(preview.getByRole('status')).toHaveText('Build plan saved as PDF.', { timeout: 60_000 })
    const bytes = readFileSync(pdf)
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(1000)
    await preview.getByRole('button', { name: 'Back to Design', exact: true }).click()
    await expect(preview).toBeHidden()
    expect(await parts.innerText()).toBe(names)
    await expect(win.getByRole('button', { name: 'View Build Plan', exact: true })).toBeVisible()
  } finally { kill(app) }
})
