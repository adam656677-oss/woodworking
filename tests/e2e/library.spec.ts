import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { serialize } from '../../src/model/fileFormat'
import { emptyProject } from '../../src/model/woods'
import { butt, makeBoard, ORIENT } from '../../src/templates/place'
import { enterMasterShop, kill, launch, newDirs, stubOpenDialog } from './helpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }

test('Library: a species page; a 36" pine shelf warns about sag and opens the calculator with its sizes', async () => {
  const dirs = newDirs()
  const p = emptyProject('Pine shelf')
  const pine = p.woods.find(w => w.id === '1x12')!
  const l = makeBoard('Left', pine, 11.25, 20, ORIENT.uprightY, { x: 0, y: 0, z: 0 })
  const r = makeBoard('Right', pine, 11.25, 20, ORIENT.uprightY, { x: 36.75, y: 0, z: 0 })
  const shelf = makeBoard('Shelf', pine, 11.25, 36, ORIENT.flatX, { x: 0.75, y: 0, z: 10 })
  const file = join(dirs.docs, 'pine-shelf.aaw')
  writeFileSync(file, serialize({ ...p, boards: [l, r, shelf], joints: [butt(l, shelf, { fastener: 'screws', count: 2 }), butt(r, shelf, { fastener: 'screws', count: 2 })] }))
  const { app, win } = await launch(dirs)
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Library', exact: true }).click()
    await win.getByLabel('Search species').fill('walnut')
    await win.getByRole('list', { name: 'Species list' }).getByText('Black walnut').click()
    await expect(win.getByRole('article', { name: 'Black walnut' })).toContainText('1010 lbf')
    await shot(win, 'library-species')
    await win.getByRole('button', { name: '← Back' }).click()

    await stubOpenDialog(app, file)
    await win.getByRole('button', { name: 'Open', exact: true }).click()
    const warn = win.getByRole('region', { name: 'Warnings' })
    await expect(warn).toContainText('Sag: loaded with books, Shelf (36" span)')
    await shot(win, 'sag-warning')
    await warn.getByRole('button', { name: 'Shelf sag calculator →' }).click()
    await expect(win.getByLabel('Span')).toHaveValue('36"')
    await expect(win.getByLabel('Depth')).toHaveValue('11-1/4"')
    await expect(win.getByRole('status', { name: 'Sag' })).toContainText('Too much sag')
    await shot(win, 'sag-calculator')
  } finally {
    kill(app)
  }
})
