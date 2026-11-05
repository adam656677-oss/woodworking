import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { addDoors, DOOR_DEFAULTS } from '../../src/cabinet/doors'
import { serialize } from '../../src/model/fileFormat'
import { addSketch, shapeBoard } from '../../src/model/shaped'
import { emptyProject } from '../../src/model/woods'
import { apron } from '../sketch/fixtures'
import { enterMasterShop, kill, launch, newDirs, stubOpenDialog, stubSaveDialog } from './helpers'

test('build plan PDF: numbered landscape drawing sheets, hardware appendix and true-size portrait templates', async ({}, testInfo) => {
  const dirs = newDirs()
  const door = addDoors(emptyProject('Cabinet door'), { x: 0, y: 0, z: 0, width: 15, height: 30 }, { ...DOOR_DEFAULTS })
  if ('error' in door) throw new Error(door.error)
  const shaped = shapeBoard(addSketch(door.project, apron()), null, 'k1', '1x6')
  if ('error' in shaped) throw new Error(shaped.error)
  const file = join(dirs.docs, 'cabinet.aaw')
  writeFileSync(file, serialize(shaped.project))
  const { app, win } = await launch(dirs)
  try {
    await enterMasterShop(win)
    await stubOpenDialog(app, file)
    await win.getByRole('button', { name: 'Open', exact: true }).click()
    const trigger = win.getByRole('button', { name: 'Create Build Plan', exact: true })
    await trigger.click()
    const preview = win.getByRole('dialog', { name: 'Build plan preview', exact: true })
    await expect(preview.getByRole('region', { name: 'Build plan hardware list' })).toContainText(/hinge/i, { timeout: 60_000 })
    await expect(preview.getByRole('region', { name: 'Build plan full-size templates' })).toBeAttached()
    const sheets = await preview.getByTestId('build-plan-sheet').count()
    const templatePages = await preview.getByTestId('build-plan-template-page').count()
    expect(templatePages).toBeGreaterThan(1)
    // Keyboard: Escape closes the preview and focus returns to the button that opened it.
    await win.keyboard.press('Escape')
    await expect(preview).toBeHidden()
    await expect(win.getByRole('button', { name: 'View Build Plan', exact: true })).toBeFocused()
    await win.getByRole('button', { name: 'View Build Plan', exact: true }).click()
    await expect(preview).toBeVisible()

    const out = testInfo.outputPath('plan.pdf')
    await stubSaveDialog(app, out)
    await preview.getByRole('button', { name: 'Save as PDF', exact: true }).click()
    await expect(preview.getByRole('status')).toHaveText('Build plan saved as PDF.', { timeout: 60_000 })
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const task = getDocument({ data: new Uint8Array(readFileSync(out)), useSystemFonts: true })
    const doc = await task.promise
    try {
      const pages: { w: number; h: number; text: string }[] = []
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n)
        const v = page.getViewport({ scale: 1 })
        const content = await page.getTextContent()
        pages.push({ w: Math.round(v.width), h: Math.round(v.height), text: content.items.map(i => ('str' in i ? i.str : '')).join(' ').replace(/\s+/g, ' ') })
      }
      // Drawing sheets come first, all landscape letter, numbered 1 of N … N of N.
      const landscape = pages.slice(0, sheets)
      landscape.forEach((p, i) => { expect([p.w, p.h]).toEqual([792, 612]); expect(p.text).toContain(`${i + 1} of ${sheets}`) })
      // Everything after is portrait letter: appendices, then the templates at true size.
      const rest = pages.slice(sheets)
      for (const p of rest) expect([p.w, p.h]).toEqual([612, 792])
      expect(rest.length).toBeGreaterThanOrEqual(templatePages + 3)
      const all = rest.map(p => p.text).join(' ')
      expect(all).toContain('Hardware list')
      expect(all).toContain('Full-size template')
      expect(all).toContain('1 inch')
      // The templates are the last pages of the packet.
      expect(rest.slice(-templatePages).every(p => /full size|Full-size template/.test(p.text))).toBe(true)
    } finally { await task.destroy() }
  } finally { kill(app) }
})
