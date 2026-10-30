import { expect, test, type Page } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { enterMasterShop, kill, launch, newDirs, stubOpenDialog, stubSaveDialog } from './helpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }

/** A 10" cube as a faceted STEP file (inches), written as other CAD programs do. */
function stepCube(): string {
  const L: string[] = []
  let n = 0
  const e = (s: string) => { n++; L.push(`#${n}=${s};`); return `#${n}` }
  const mm = e(`(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.))`)
  e(`(CONVERSION_BASED_UNIT('INCH',${e(`LENGTH_MEASURE_WITH_UNIT(LENGTH_MEASURE(25.4),${mm})`)}) LENGTH_UNIT() NAMED_UNIT(*))`)
  const c = [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0], [0, 0, 10], [10, 0, 10], [10, 10, 10], [0, 10, 10]].map(q => e(`CARTESIAN_POINT('',(${q.join(',')}))`))
  const faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]].map(f => e(`FACE('',(${e(`FACE_OUTER_BOUND('',${e(`POLY_LOOP('',(${f.map(i => c[i]).join(',')}))`)},.T.)`)}))`))
  e(`FACETED_BREP('cube',${e(`CLOSED_SHELL('',(${faces.join(',')}))`)})`)
  return `ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\n${L.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`
}

test('export a bookshelf as STL; bring in a STEP cube as a reference and the interference check finds a shelf through it', async () => {
  const dirs = newDirs()
  const { app, win } = await launch(dirs)
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Bookshelf', exact: true }).click()
    const stl = join(dirs.docs, 'shelf.stl')
    await stubSaveDialog(app, stl)
    await win.getByRole('button', { name: '3D files ▾' }).click()
    await win.getByRole('menuitem', { name: 'Export…' }).click()
    const dlg = win.getByRole('dialog', { name: 'Export' })
    await dlg.getByRole('button', { name: 'Export…' }).click()
    await expect(dlg.getByRole('status')).toContainText(/^Exported \d+ parts to shelf\.stl \(inches\)$/)
    await shot(win, 'export')
    await dlg.getByRole('button', { name: 'Done' }).click()
    expect(existsSync(stl)).toBe(true)
    // Bounds of the file: 30 × 10 × 36.
    const b = readFileSync(stl)
    const count = b.readUInt32LE(80)
    const max = [-Infinity, -Infinity, -Infinity]
    for (let t = 0; t < count; t++) for (let k = 0; k < 9; k++) max[k % 3] = Math.max(max[k % 3], b.readFloatLE(84 + t * 50 + 12 + k * 4))
    expect(max.map(v => Math.round(v * 1000) / 1000)).toEqual([30, 10, 36])

    const step = join(dirs.docs, 'cube.step')
    writeFileSync(step, stepCube())
    await stubOpenDialog(app, step)
    await win.getByRole('button', { name: '3D files ▾' }).click()
    await win.getByRole('menuitem', { name: 'Import reference model…' }).click()
    const imp = win.getByRole('dialog', { name: 'Import a reference model' })
    await expect(imp).toContainText("The file says it's in inches")
    await expect(imp.getByTestId('model-size')).toHaveText('10" × 10" × 10"')
    await imp.getByRole('button', { name: 'Add to the design' }).click()
    const list = win.getByRole('region', { name: 'Reference models' })
    await expect(list).toContainText('cube')
    // Move it into the middle of the shelf.
    await list.getByRole('button', { name: 'cube', exact: true }).click()
    for (const [a, v] of [['X', '10'], ['Z', '10']]) {
      const box = list.getByLabel(`${a} of cube`, { exact: true })
      await box.fill(v)
      await box.press('Enter')
    }
    await shot(win, 'model')
    await win.getByRole('button', { name: 'Checks ▾' }).click()
    await win.getByRole('menuitem', { name: 'Interference' }).click()
    await win.getByRole('button', { name: 'Check for interference' }).click()
    await expect(win.getByRole('list', { name: 'Interferences' })).toContainText(/Shelf and cube run into each other/, { timeout: 30_000 })
  } finally {
    kill(app)
  }
})
