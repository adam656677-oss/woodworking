import { expect, type Page } from '@playwright/test'

export async function sheetBox(win: Page) {
  return (await win.getByTestId('drawing-sheet').boundingBox())!
}
/** Where a drawing point is on screen. */
export async function pointAt(win: Page, id: string) {
  const c = win.locator(`circle[data-point="${id}"]`)
  return { x: Number(await c.getAttribute('cx')), y: Number(await c.getAttribute('cy')) }
}
export async function clickSheet(win: Page, x: number, y: number) {
  const b = await sheetBox(win)
  await win.mouse.move(b.x + x, b.y + y)
  await win.mouse.click(b.x + x, b.y + y)
}
export async function typeSize(win: Page, text: string) {
  await win.keyboard.type(text, { delay: 60 })
  await win.keyboard.press('Enter')
}

export async function drawApron(win: Page) {
  await win.getByRole('button', { name: '✏️ Draw a shape ▾' }).click()
  await win.getByRole('menuitem', { name: 'New drawing' }).click()
  await expect(win.getByTestId('drawing-sheet')).toBeVisible()
  await win.getByRole('textbox', { name: 'Drawing name' }).fill('Apron')
  // Zoom out a little so 30" fits.
  const b0 = await sheetBox(win)
  await win.mouse.move(b0.x + 300, b0.y + 300)
  await win.mouse.wheel(0, 300)
  // Ends and top with typed sizes: up 4", across 30", down 4".
  await win.getByRole('button', { name: 'Line', exact: true }).click()
  await clickSheet(win, 80, 450)
  for (const t of ['4@90', '30@0', '4@-90']) {
    await win.mouse.move((await sheetBox(win)).x + 400, (await sheetBox(win)).y + 300)
    await typeSize(win, t)
  }
  await win.keyboard.press('Escape')
  await expect(win.locator('path[data-kind="line"]')).toHaveCount(3)
  // The arch: from the bottom right corner to the bottom left, rising 2" in the middle.
  const ids = await win.locator('circle[data-point]').evaluateAll(cs => cs.map(c => c.getAttribute('data-point')!))
  const pts = await Promise.all(ids.map(id => pointAt(win, id)))
  const bottomY = Math.max(...pts.map(p => p.y))
  const bottom = pts.filter(p => Math.abs(p.y - bottomY) < 1)
  const left = bottom.reduce((a, p) => (p.x < a.x ? p : a))
  const right = bottom.reduce((a, p) => (p.x > a.x ? p : a))
  const scale = (right.x - left.x) / 30
  await win.getByRole('button', { name: 'Arc (3 points)' }).click()
  await clickSheet(win, right.x, right.y)
  await clickSheet(win, left.x, left.y)
  await clickSheet(win, (left.x + right.x) / 2, left.y - 2 * scale)
  await expect(win.locator('path[data-kind="arc"]')).toHaveCount(1)
  // Dimension the top: 30".
  await win.getByRole('button', { name: 'Dimension' }).click()
  const top = { x: (left.x + right.x) / 2, y: left.y - 4 * scale }
  await clickSheet(win, top.x + 37, top.y)
  const dlg = win.getByRole('dialog', { name: 'Add a dimension' })
  await expect(dlg.getByLabel('Size')).toHaveValue('30')
  await dlg.getByRole('button', { name: 'OK' }).click()
  await expect(win.locator('[data-dimension]')).toHaveCount(1)
}

