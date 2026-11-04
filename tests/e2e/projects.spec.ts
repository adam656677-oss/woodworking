import { expect, test, type Page } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs, selectInspectorTab } from './helpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }

test('every new template starts with no warnings; the new kids projects have sheets', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await shot(win, 'projects-start')
    const parts: Record<string, number> = { 'Side table': 11, Workbench: 12, 'Base cabinet': 9, 'Cutting board': 6, 'Step stool': 5, 'Wall shelf': 6 }
    for (const [name, n] of Object.entries(parts)) {
      await win.getByRole('button', { name: 'New ▾' }).click()
      await win.getByRole('menuitem', { name, exact: true }).click()
      const discard = win.getByRole('button', { name: /Don.t save|Discard/ })
      if (await discard.isVisible().catch(() => false)) await discard.click()
      await expect(win.getByText(`PARTS (${n})`)).toBeVisible()
      await expect(win.getByRole('region', { name: 'Warnings' })).toHaveCount(0)
      await shot(win, `projects-${name.replace(/\W+/g, '-')}`)
    }
    await win.getByRole('button', { name: 'New ▾' }).click()
    await win.getByRole('menuitem', { name: 'Side table', exact: true }).click()
    const d0 = win.getByRole('button', { name: /Don.t save|Discard/ })
    if (await d0.isVisible().catch(() => false)) await d0.click()
    await win.getByRole('button', { name: 'Cut List' }).click()
    await expect(win.getByRole('region', { name: 'Hardware' })).toContainText('Tabletop fasteners (figure-8)')
    await win.keyboard.press('Escape')
    await win.getByRole('button', { name: /Close/ }).first().click().catch(() => {})
    await win.getByRole('button', { name: 'New ▾' }).click()
    await win.getByRole('menuitem', { name: 'Cutting board', exact: true }).click()
    const discard = win.getByRole('button', { name: /Don.t save|Discard/ })
    if (await discard.isVisible().catch(() => false)) await discard.click()
    await selectInspectorTab(win, 'Template')
    await win.getByLabel('Strips').fill('8')
    await win.getByLabel('Strips').press('Tab')
    await expect(win.getByText('PARTS (8)')).toBeVisible()
    await win.getByRole('button', { name: '⌂ Home' }).click()
    const dont = win.getByRole('button', { name: /Don.t save|Discard/ })
    if (await dont.isVisible().catch(() => false)) await dont.click()
    await win.getByRole('button', { name: /Kids' Workshop/ }).click()
    await win.getByRole('button', { name: 'Projects' }).click()
    for (const p of ['Coaster set', 'Bookends', 'Phone stand', 'Planter box']) await expect(win.getByRole('button', { name: new RegExp(p) })).toBeVisible()
    await shot(win, 'projects-kids')
    await win.getByRole('button', { name: /Planter box/ }).click()
    await expect(win.getByText(/drain out underneath/)).toBeVisible()
    await shot(win, 'projects-planter')
  } finally { kill(app) }
})
