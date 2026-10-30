import { expect, test, type Page } from '@playwright/test'
import { cutListRows, enterMasterShop, kill, launch, newDirs, startTemplate } from './helpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }
async function type(win: Page, dialog: ReturnType<Page['getByRole']>, label: string, value: string) {
  const box = dialog.getByLabel(label, { exact: true })
  await box.fill(value)
  await box.press('Tab')
}

test('a Shaker door and a drawer: cut list, hardware, opened in 3D, clearance checked', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await startTemplate(win, 'Box')
    await win.getByRole('button', { name: 'New ▾' }).click()
    await win.getByRole('menuitem', { name: 'Blank project' }).click()

    await win.getByRole('button', { name: 'Cabinet ▾' }).click()
    await win.getByRole('menuitem', { name: 'Door…' }).click()
    const door = win.getByRole('dialog', { name: 'Add a door' })
    await type(win, door, 'Opening width', '15')
    await type(win, door, 'Opening height', '30')
    await shot(win, 'door-maker')
    await door.getByRole('button', { name: 'Make it' }).click()
    await expect(door).toHaveCount(0)

    await win.getByRole('button', { name: 'Cabinet ▾' }).click()
    await win.getByRole('menuitem', { name: 'Drawer…' }).click()
    const drawer = win.getByRole('dialog', { name: 'Add a drawer' })
    await type(win, drawer, 'Left (X)', '30')
    await type(win, drawer, 'Opening width', '16')
    await type(win, drawer, 'Opening height', '6')
    await type(win, drawer, 'Opening depth', '22')
    await drawer.getByRole('button', { name: 'Make it' }).click()
    await expect(drawer).toHaveCount(0)

    const rows = await cutListRows(win)
    expect(rows.find(r => r[1] === 'Rail')?.slice(0, 5)).toEqual(['2', 'Rail', '3/4"', '2-1/4"', '12-1/4"'])
    expect(rows.find(r => r[1] === 'Drawer side')?.slice(0, 5)).toEqual(['2', 'Drawer side', '15/32"', '5"', '20"'])
    expect(rows.find(r => r[1] === 'Stile')?.[7]).toContain('1/4" groove × 3/8" deep in the edge')
    await win.getByRole('button', { name: 'Cut List' }).click()
    const hw = win.getByRole('region', { name: 'Hardware' })
    await expect(hw).toContainText('Concealed hinge, full overlay (35 mm)')
    await expect(hw).toContainText('Side-mount ball-bearing slides 20" (pair)')
    await shot(win, 'hardware')
    await win.getByRole('dialog', { name: 'Cut list' }).getByRole('button', { name: 'Close' }).click()

    await win.getByLabel('Open doors and drawers').fill('100')
    await shot(win, 'opened')
    await win.getByRole('button', { name: 'Checks ▾' }).click()
    await win.getByRole('menuitem', { name: 'Door & drawer clearance' }).click()
    await win.getByRole('button', { name: 'Check clearance' }).click()
    await expect(win.getByRole('status')).toContainText('Every door and drawer opens clear', { timeout: 30_000 })
  } finally {
    kill(app)
  }
})
