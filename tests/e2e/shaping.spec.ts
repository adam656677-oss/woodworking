import { expect, test, type Page } from '@playwright/test'
import { cutListRows, enterMasterShop, kill, launch, newDirs } from './helpers'
import { drawApron } from './drawHelpers'

const SHOTS = process.env.AA_SHOTS

async function open(win: Page, section: 'Turning' | 'Taper' | 'Edges') {
  await win.locator('summary', { hasText: new RegExp(`^${section}$`) }).click()
}

async function addPart(win: Page, wood: string) {
  await win.getByRole('button', { name: 'Add board' }).click()
  await win.getByLabel('Wood').selectOption(wood)
}

test('shaping 1. turn a 2x2 leg (vase) and print its turning sheet', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await addPart(win, '2x2')
    await open(win, 'Turning')
    await win.getByRole('button', { name: 'Turn this leg' }).click()
    await expect(win.getByLabel('Turning style')).toHaveValue('vase')
    if (SHOTS) { await win.getByRole('button', { name: 'Fit' }).click(); await win.waitForTimeout(800); await win.screenshot({ path: `${SHOTS}/turned.png` }) }
    const rows = await cutListRows(win)
    expect(rows[0][7]).toContain('Turned — 3" pommel (see turning sheet)')
    await win.getByRole('button', { name: 'Turning sheet' }).click()
    const sheet = win.getByRole('dialog', { name: 'Turning sheet' })
    await expect(sheet.getByRole('table', { name: 'Stations' }).getByRole('row')).not.toHaveCount(1)
    await expect(sheet.getByRole('region', { name: 'Page A1' })).toBeVisible()
    if (SHOTS) await win.screenshot({ path: `${SHOTS}/turning-sheet.png` })
    await sheet.getByRole('button', { name: '← Back to the design' }).click()
  } finally {
    kill(app)
  }
})

test('shaping 2. taper a leg on two faces; the cut list note and the taper sheet', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await addPart(win, '2x2')
    await open(win, 'Taper')
    await win.getByRole('button', { name: 'Taper this part' }).click()
    await expect(win.getByText(/off each face at the foot/)).toBeVisible()
    if (SHOTS) { await win.getByRole('button', { name: 'Fit' }).click(); await win.waitForTimeout(800); await win.screenshot({ path: `${SHOTS}/tapered.png` }) }
    const rows = await cutListRows(win)
    expect(rows[0][7]).toMatch(/Taper 2 faces: 1-1\/2" → \S+ over \S+, starting \S+ from the top/)
    await win.getByRole('button', { name: 'Taper sheet' }).click()
    const sheet = win.getByRole('dialog', { name: 'Taper sheet' })
    await expect(sheet.getByRole('table', { name: 'Faces' }).getByRole('row')).toHaveCount(3)
    await sheet.getByRole('button', { name: '← Back to the design' }).click()
  } finally {
    kill(app)
  }
})

test('shaping 3. roundover a tabletop\'s top edges, and an arched apron\'s outline', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await addPart(win, '1x12')
    await open(win, 'Edges')
    await win.getByRole('button', { name: 'All top edges' }).click()
    await win.getByRole('button', { name: 'Add roundover' }).click()
    await expect(win.getByText('1/4" roundover — top edges (all 4)')).toBeVisible()
    await drawApron(win)
    await win.getByRole('button', { name: 'Cut a board to this shape' }).click()
    const pick = win.getByRole('dialog', { name: 'Choose the wood' })
    await pick.getByLabel('Wood').selectOption('1x6')
    await pick.getByRole('button', { name: 'Cut it' }).click()
    await open(win, 'Edges')
    await win.getByRole('radio', { name: '3/8"' }).click()
    await win.getByRole('button', { name: 'Add roundover' }).click()
    await expect(win.getByText('3/8" roundover — top outline')).toBeVisible()
    if (SHOTS) { await win.getByRole('button', { name: 'Fit' }).click(); await win.waitForTimeout(800); await win.screenshot({ path: `${SHOTS}/edges.png` }) }
    const notes = (await cutListRows(win)).map(r => r[7]).join(' | ')
    expect(notes).toContain('1/4" roundover — top edges (all 4)')
    expect(notes).toContain('3/8" roundover — top outline')
  } finally {
    kill(app)
  }
})

test('shaping 4. kids round the edges in the Simple Designer', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await win.getByRole('button', { name: /Kids' Workshop/ }).click()
    await win.getByRole('button', { name: 'Simple Designer' }).click()
    await win.getByRole('button', { name: 'Add board' }).click()
    await expect(win.getByText(/sand, or router with a grown-up/)).toBeVisible()
    await expect(win.getByRole('button', { name: 'Turn this leg' })).toHaveCount(0)
    await win.getByRole('button', { name: 'All top edges' }).click()
    await win.getByRole('radio', { name: '1/8"' }).click()
    await win.getByRole('button', { name: 'Add roundover' }).click()
    if (SHOTS) await win.screenshot({ path: `${SHOTS}/kids-edges.png` })
    const rows = await cutListRows(win)
    expect(rows[0][7]).toContain('1/8" roundover — top edges (all 4)')
  } finally {
    kill(app)
  }
})
