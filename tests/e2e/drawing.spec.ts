import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cutListRows, enterMasterShop, kill, launch, newDirs, stubSaveDialog } from './helpers'

const SHOTS = process.env.AA_SHOTS

async function sheetBox(win: Page) {
  return (await win.getByTestId('drawing-sheet').boundingBox())!
}
/** Where a drawing point is on screen. */
async function pointAt(win: Page, id: string) {
  const c = win.locator(`circle[data-point="${id}"]`)
  return { x: Number(await c.getAttribute('cx')), y: Number(await c.getAttribute('cy')) }
}
async function clickSheet(win: Page, x: number, y: number) {
  const b = await sheetBox(win)
  await win.mouse.move(b.x + x, b.y + y)
  await win.mouse.click(b.x + x, b.y + y)
}
async function typeSize(win: Page, text: string) {
  await win.keyboard.type(text, { delay: 60 })
  await win.keyboard.press('Enter')
}

async function drawApron(win: Page) {
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

test('drawing 1. an arched apron, cut from a 1x6, lists as 30 × 4 with the Shaped note', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await drawApron(win)
    await expect(win.getByTestId('solve-status')).toContainText('Can still move')
    if (SHOTS) await win.screenshot({ path: `${SHOTS}/draw-apron.png` })
    await win.getByRole('button', { name: 'Cut a board to this shape' }).click()
    const pick = win.getByRole('dialog', { name: 'Choose the wood' })
    await pick.getByLabel('Wood').selectOption('1x6')
    await pick.getByRole('button', { name: 'Cut it' }).click()
    await expect(win.getByRole('navigation', { name: 'Toolbar' })).toBeVisible()
    if (SHOTS) await win.waitForTimeout(800)
    if (SHOTS) await win.screenshot({ path: `${SHOTS}/draw-apron-3d.png` })
    const rows = await cutListRows(win)
    expect(rows).toHaveLength(1)
    expect(rows[0].slice(1, 6)).toEqual(['Apron', '3/4"', '4"', '30"', '1x6'])
    expect(rows[0][7]).toContain('Shaped — cut to pattern (print full size)')
  } finally {
    kill(app)
  }
})

test('drawing 2. print full size: five pages for a 30" part, each with a true 1" check square', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await drawApron(win)
    await win.getByRole('button', { name: 'Print full size' }).click()
    const pages = win.getByRole('region', { name: /^Page [A-Z]\d$/ })
    await expect(pages).toHaveCount(5)
    const sq = (await win.getByTestId('check-square').first().boundingBox())!
    expect(Math.round(sq.width)).toBe(96)
    expect(Math.round(sq.height)).toBe(96)
    if (SHOTS) await win.screenshot({ path: `${SHOTS}/draw-print.png` })
    // The printed pages are letter size, one tile per sheet.
    const count = await app.evaluate(async ({ BrowserWindow }) => {
      const data = await BrowserWindow.getAllWindows()[0].webContents.printToPDF({ pageSize: 'Letter', preferCSSPageSize: true })
      return (data.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
    })
    expect(count).toBe(5)
    await win.getByRole('button', { name: '← Back to the drawing' }).click()
  } finally {
    kill(app)
  }
})

test('drawing 3. export DXF and SVG at true size', async () => {
  const dirs = newDirs()
  const { app, win } = await launch(dirs)
  try {
    await enterMasterShop(win)
    await drawApron(win)
    const dxf = join(dirs.docs, 'Apron.dxf')
    await stubSaveDialog(app, dxf)
    await win.getByRole('button', { name: 'Export DXF' }).click()
    await expect(win.getByRole('status')).toContainText('Apron.dxf')
    const d = readFileSync(dxf, 'utf8')
    expect(d).toContain('$INSUNITS\n70\n1')
    expect(d).toMatch(/0\nARC\n8\nOUTLINE\n/)
    // Line lengths: two 4" ends and the 30" top.
    const lens = [...d.matchAll(/0\nLINE\n8\nOUTLINE\n10\n(\S+)\n20\n(\S+)\n30\n0\n11\n(\S+)\n21\n(\S+)\n/g)]
      .map(m => Math.round(Math.hypot(Number(m[3]) - Number(m[1]), Number(m[4]) - Number(m[2])) * 1000) / 1000).sort((a, b) => a - b)
    expect(lens).toEqual([4, 4, 30])
    const svg = join(dirs.docs, 'Apron.svg')
    await stubSaveDialog(app, svg)
    await win.getByRole('button', { name: 'Export SVG' }).click()
    await expect(win.getByRole('status')).toContainText('Apron.svg')
    const s = readFileSync(svg, 'utf8')
    expect(s).toContain('width="30in"')
    expect(s).toContain('height="4in"')
    expect(s).toMatch(/ A 57\.25 57\.25 /)
  } finally {
    kill(app)
  }
})

test('drawing 4. kids: freehand a heart, print it, make it a part from a 1x8', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await win.getByRole('button', { name: /Kids' Workshop/ }).click()
    await win.getByRole('button', { name: 'Draw It!' }).click()
    await expect(win.getByRole('heading', { name: 'Draw It!' })).toBeVisible()
    const b = await sheetBox(win)
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2
    const heart = Array.from({ length: 90 }, (_, i) => {
      const t = (2 * Math.PI * i) / 89
      return { x: cx + 10 * 16 * Math.sin(t) ** 3, y: cy - 10 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) }
    })
    await win.mouse.move(heart[0].x, heart[0].y)
    await win.mouse.down()
    for (const p of heart.slice(1)) await win.mouse.move(p.x, p.y)
    await win.mouse.up()
    await expect(win.locator('[data-entity]').first()).toBeVisible()
    if (SHOTS) await win.screenshot({ path: `${SHOTS}/draw-kids.png` })
    await win.getByLabel('Width in inches').fill('6')
    await win.getByLabel('Width in inches').press('Enter')
    await expect(win.getByLabel('Width in inches')).toHaveValue('6')
    await win.getByRole('button', { name: 'Print it' }).click()
    await expect(win.getByRole('region', { name: 'Page A1' })).toBeVisible()
    await win.getByRole('button', { name: '← Back to the drawing' }).click()
    await win.getByRole('button', { name: 'Make it a part!' }).click()
    const pick = win.getByRole('dialog', { name: 'Choose the wood' })
    await expect(pick.getByLabel('Wood')).toHaveValue('1x8')
    await pick.getByRole('button', { name: 'Cut it' }).click()
    await expect(win.getByText('Simple Designer')).toBeVisible()
    const rows = await cutListRows(win)
    expect(rows).toHaveLength(1)
    expect(rows[0][4]).toBe('6"')
    expect(rows[0][5]).toBe('1x8')
    expect(rows[0][7]).toContain('Shaped')
  } finally {
    kill(app)
  }
})

test('drawing 5. clicking back on the first point closes the outline and stops the line tool', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: '✏️ Draw a shape ▾' }).click()
    await win.getByRole('menuitem', { name: 'New drawing' }).click()
    await win.getByRole('button', { name: 'Line', exact: true }).click()
    await clickSheet(win, 200, 400)
    await clickSheet(win, 500, 400)
    await clickSheet(win, 350, 200)
    const first = await pointAt(win, (await win.locator('circle[data-point]').first().getAttribute('data-point'))!)
    await clickSheet(win, first.x, first.y)
    await expect(win.locator('path[data-kind="line"]')).toHaveCount(3)
    await expect(win.getByRole('button', { name: 'Cut a board to this shape' })).toBeEnabled()
    // The tool stopped: the next click starts a new line rather than adding a fourth side.
    await clickSheet(win, 600, 300)
    await expect(win.locator('path[data-kind="line"]')).toHaveCount(3)
  } finally {
    kill(app)
  }
})
