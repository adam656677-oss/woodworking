import { expect, test } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs } from './helpers'
import { clickSheet, sheetBox, typeSize } from './drawHelpers'

test('Custom opens a blank sketch, reviews a closed profile, and creates a 3D part', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    const tools = win.getByRole('region', { name: 'Design tools' })
    await tools.getByRole('button', { name: 'Custom', exact: true }).click()
    await expect(win.getByTestId('drawing-sheet')).toBeVisible()
    const workspace = win.getByRole('navigation', { name: 'Workspace', exact: true })
    await expect(workspace.getByRole('link', { name: 'Design', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(workspace.getByRole('link', { name: 'Drawing Board', exact: true })).toHaveCount(0)
    await expect(win.locator('path[data-kind="line"]')).toHaveCount(0)
    await win.getByText('Review custom profile', { exact: true }).click()
    await expect(tools.getByRole('status')).toContainText('Draw a closed shape first')
    await win.getByRole('textbox', { name: 'Drawing name' }).fill('Custom test panel')
    await win.getByRole('button', { name: 'Line', exact: true }).click()
    await clickSheet(win, 100, 200)
    for (const size of ['4@90', '6@0', '4@-90', '6@180']) {
      const box = await sheetBox(win)
      await win.mouse.move(box.x + 250, box.y + 150)
      await typeSize(win, size)
    }
    await win.keyboard.press('Escape')
    await expect(win.locator('path[data-kind="line"]')).toHaveCount(4)
    await expect(tools).toContainText('Closed profile detected.')
    await win.getByRole('button', { name: 'Cut a board to this shape', exact: true }).click()
    const wood = win.getByRole('dialog', { name: 'Choose the wood' })
    await expect(wood.getByLabel('Wood')).not.toHaveValue('')
    await wood.getByRole('button', { name: 'Cut it', exact: true }).click()
    await expect(win.getByRole('list', { name: 'Parts', exact: true })).toContainText('Custom test panel')
    await expect(tools.getByRole('button', { name: '3D', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await tools.getByRole('button', { name: 'Sketch', exact: true }).click()
    await expect(win.getByRole('textbox', { name: 'Drawing name' })).toHaveValue('Custom test panel')
    await expect(win.locator('path[data-kind="line"]')).toHaveCount(4)
  } finally { kill(app) }
})
