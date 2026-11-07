import { expect, test, type Page } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs } from './helpers'

const bar = (win: Page) => win.getByRole('toolbar', { name: 'Custom modeling' })
async function clickScene(win: Page, fx: number, fy: number) {
  const box = (await win.getByTestId('scene').boundingBox())!
  await win.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
}
async function typeSize(win: Page, text: string) {
  const input = bar(win).getByRole('textbox')
  await input.fill(text)
  await input.press('Enter')
}

test('Custom: sketch on the floor, pull into parts, cut through, push/pull, split a block into panels', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    const tools = win.getByRole('region', { name: 'Design tools' })
    await tools.getByRole('button', { name: 'Custom', exact: true }).click()
    await expect(bar(win)).toBeVisible()
    await expect(tools.getByRole('button', { name: 'Custom', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(win.getByTestId('scene')).toBeVisible()
    const parts = win.getByRole('list', { name: 'Parts', exact: true })
    const hint = bar(win).getByRole('status', { name: 'Modeling hint' })

    // A 30 x 12 panel, 3/4 thick, from one click and two typed sizes.
    await bar(win).getByRole('button', { name: 'Floor', exact: true }).click()
    await bar(win).getByRole('button', { name: 'Rectangle', exact: true }).click()
    await clickScene(win, 0.5, 0.5)
    await typeSize(win, '30 x 12')
    await expect(hint).toContainText('pull it into a solid')
    await win.waitForTimeout(500)
    await win.screenshot({ path: 'test-results/custom-1-pull-preview.png' })
    await typeSize(win, '3/4')
    await expect(parts).toContainText('Part 1')

    // A 12 x 12 block 36 high is offered for splitting.
    await bar(win).getByRole('button', { name: 'Rectangle', exact: true }).click()
    await clickScene(win, 0.25, 0.7)
    await typeSize(win, '24 x 12')
    await typeSize(win, '30')
    await expect(hint).toContainText('Split into panels')
    await expect(parts).toContainText('Part 2')
    await win.waitForTimeout(500)
    await win.screenshot({ path: 'test-results/custom-2-block.png' })
    await bar(win).getByRole('button', { name: 'Split into panels…' }).click()
    const d = win.getByRole('dialog', { name: 'Split into panels' })
    await expect(d.getByLabel('Width')).toHaveValue('24"')
    await expect(d.getByLabel('Height')).toHaveValue('30"')
    await d.getByRole('button', { name: 'Replace the block' }).click()
    await expect(parts).not.toContainText('Part 2')
    await expect(parts).toContainText('Side')
    await win.waitForTimeout(500)
    await win.screenshot({ path: 'test-results/custom-3-split.png' })

    await expect(hint).toContainText('Split into 7 panels')
    // Done turns the tools off.
    await bar(win).getByRole('button', { name: 'Done' }).click()
    await expect(bar(win)).toHaveCount(0)
  } finally { kill(app) }
})

test('Custom: click a part face to sketch on it and cut through, and Push/Pull a face', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await win.getByRole('region', { name: 'Design tools' }).getByRole('button', { name: 'Custom', exact: true }).click()
    const hint = bar(win).getByRole('status', { name: 'Modeling hint' })
    await bar(win).getByRole('button', { name: 'Rectangle', exact: true }).click()
    await clickScene(win, 0.5, 0.5)
    await typeSize(win, '30 x 30')
    await typeSize(win, '3/4')
    const parts = win.getByRole('list', { name: 'Parts', exact: true })
    await expect(parts).toContainText('Part 1')
    await win.waitForTimeout(800)
    // The new part fills the middle of the view: click its top.
    await bar(win).getByRole('button', { name: 'Part face', exact: true }).click()
    await clickScene(win, 0.5, 0.55)
    await expect(hint).toContainText("Part 1's face")
    await bar(win).getByRole('button', { name: 'Circle', exact: true }).click()
    await clickScene(win, 0.5, 0.55)
    await typeSize(win, '4')
    await typeSize(win, '-1')
    await expect(hint).toContainText('Cut through')
    await win.waitForTimeout(500)
    await win.screenshot({ path: 'test-results/custom-4-cut.png' })
    // Push/Pull the top face up 3/4: twice as thick.
    await bar(win).getByRole('button', { name: 'Push/Pull', exact: true }).click()
    await clickScene(win, 0.42, 0.5)
    await expect(hint).toContainText('how far to move that face')
    await typeSize(win, '3/4')
    await expect(hint).toContainText('Moved the face')
    await parts.getByText('Part 1').click()
    await bar(win).getByRole('button', { name: 'Done' }).click()
    // Push/Pull moves a face exactly as far as typed: 23/32 plywood + 3/4.
    await expect(win.getByTitle('Set by the wood')).toHaveText('1-15/32"')
  } finally { kill(app) }
})

test('Custom on the empty-design start screen opens the modeling tools', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Custom', exact: true }).first().click()
    await expect(bar(win)).toBeVisible()
    await expect(win.getByTestId('scene')).toBeVisible()
  } finally { kill(app) }
})
