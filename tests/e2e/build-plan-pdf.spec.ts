import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { enterMasterShop, kill, launch, newDirs, startTemplate, stubSaveDialog } from './helpers'

test('exported build-plan PDF contains captured shopping text and total', async ({}, testInfo) => {
  const dirs = newDirs()
  const { app, win } = await launch(dirs)
  try {
    await enterMasterShop(win)
    await startTemplate(win, 'Box')
    await win.getByRole('button', { name: 'Create Build Plan', exact: true }).click()
    const preview = win.getByRole('dialog', { name: 'Build plan preview' })
    const shopping = preview.getByRole('region', { name: 'Build plan shopping list' })
    await expect(shopping).toBeAttached({ timeout: 60000 })
    const total = await shopping.getByTestId('build-plan-shopping-total').innerText()
    const rows = await shopping.locator('tbody tr td:first-child').allTextContents()
    const output = testInfo.outputPath('build-plan.pdf')
    await stubSaveDialog(app, output)
    await preview.getByRole('button', { name: 'Save as PDF', exact: true }).click()
    await expect(preview.getByRole('status')).toHaveText('Build plan saved as PDF.', { timeout: 60000 })
    const bytes = readFileSync(output)
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
    const doc = await task.promise
    try {
      const pages: string[] = []
      for (let number = 1; number <= doc.numPages; number++) {
        const page = await doc.getPage(number)
        const content = await page.getTextContent()
        const text: string[] = []
        const viewport = page.getViewport({ scale: 1 })
        for (const item of content.items) {
          if (!('str' in item)) continue
          text.push(item.str)
          if (!item.str.trim()) continue
          expect(item.transform[4]).toBeGreaterThanOrEqual(-1)
          expect(item.transform[4] + item.width).toBeLessThanOrEqual(viewport.width + 2)
          expect(item.transform[5]).toBeGreaterThanOrEqual(-2)
          expect(item.transform[5]).toBeLessThanOrEqual(viewport.height + 2)
        }
        pages.push(text.join(' '))
      }
      const normalized = (value: string) => value.replace(/\s+/g, ' ').trim()
      const text = normalized(pages.join(' '))
      expect(text).toContain('Shopping list')
      expect(text).toContain('Estimated priced total')
      expect(text).toContain(total)
      expect(text).toContain('Estimated priced total excludes items without prices.')
      for (const row of rows) expect(text).toContain(normalized(row))
      await testInfo.attach('exported build plan', { path: output, contentType: 'application/pdf' })
    } finally { await task.destroy() }
  } finally { kill(app) }
})
