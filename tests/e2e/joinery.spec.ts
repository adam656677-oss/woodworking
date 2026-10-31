import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { serialize } from '../../src/model/fileFormat'
import { emptyProject } from '../../src/model/woods'
import { makeBoard, ORIENT } from '../../src/templates/place'
import { cutListRows, enterMasterShop, kill, launch, newDirs, part, stubOpenDialog } from './helpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }

test('joinery: a mortise and tenon lengthens the rail in the cut list; a lap designed in the joint designer joins two beams', async () => {
  const dirs = newDirs()
  const p = emptyProject('Joints')
  const hw = p.woods.find(w => w.id === 'hw-4-4')!
  p.woods.push({ ...hw, id: 'leg', name: 'Leg stock', thickness: 1.75, width: 1.75, builtIn: false })
  p.woods.push({ ...hw, id: 'beam', name: 'Beam stock', thickness: 3.5, width: 3.5, builtIn: false })
  const leg = makeBoard('Leg', p.woods.find(w => w.id === 'leg')!, 1.75, 28, ORIENT.uprightX, { x: 0, y: 0, z: 0 })
  const rail = makeBoard('Rail', hw, 4, 20, ORIENT.wallX, { x: 1.75, y: 0.5, z: 20 })
  const beamA = makeBoard('Beam A', p.woods.find(w => w.id === 'beam')!, 3.5, 30, ORIENT.flatX, { x: 0, y: 20, z: 0 })
  const beamB = makeBoard('Beam B', p.woods.find(w => w.id === 'beam')!, 3.5, 30, ORIENT.flatX, { x: 30, y: 20, z: 0 })
  const file = join(dirs.docs, 'joints.aaw')
  writeFileSync(file, serialize({ ...p, boards: [leg, rail, beamA, beamB] }))
  const { app, win } = await launch(dirs)
  try {
    await enterMasterShop(win)
    await stubOpenDialog(app, file)
    await win.getByRole('button', { name: 'Open', exact: true }).click()
    await part(win, 'Leg').click()
    await part(win, 'Rail').click({ modifiers: ['Control'] })
    const panel = win.getByRole('region', { name: 'Joint' })
    await panel.getByLabel('Cut joint').selectOption({ label: 'Mortise and tenon' })
    await expect(panel).toContainText('mortise and tenon')
    await shot(win, 'mortise-tenon')
    const rows = await cutListRows(win)
    expect(rows.find(r => r[1] === 'Rail')?.[4]).toBe('21-1/4"')

    // Design a half lap and use it between the beams.
    await win.getByRole('button', { name: 'Joint designer' }).click()
    await win.getByRole('button', { name: 'Lap' }).click()
    await expect(win.getByRole('status', { name: 'Feedback' })).toContainText('This joint works')
    await win.getByLabel('Joint name').fill('Lap splice')
    await win.getByRole('button', { name: 'Save to this project' }).click()
    await shot(win, 'joint-designer')
    await win.getByRole('button', { name: '← Back' }).click()
    await part(win, 'Beam A').click()
    await part(win, 'Beam B').click({ modifiers: ['Control'] })
    await panel.getByLabel('Cut joint').selectOption({ label: 'Lap splice (designed)' })
    await expect(panel).toContainText('custom joint')
    await expect(win.getByRole('region', { name: 'Warnings' })).toHaveCount(0)
  } finally {
    kill(app)
  }
})
