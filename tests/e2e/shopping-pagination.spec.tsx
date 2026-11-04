import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { BuildPlanShopping } from '../../src/drawings/ui/BuildPlanShopping'
import type { createShoppingSnapshot } from '../../src/drawings/shoppingSnapshot'
import { kill, launch, newDirs } from './helpers'

test('160 captured shopping rows wrap across PDF pages with repeated headers and no lost rows', async ({}, testInfo) => {
  const lines = Array.from({ length: 160 }, (_, index) => ({ section: 'wood' as const, what: `SKU${String(index).padStart(4, '0')} Long material description with grain direction and purchasing notes to exercise wrapping`, qty: 1, unit: 'sheet', each: 1, total: 1 }))
  const snapshot: ReturnType<typeof createShoppingSnapshot> = {
    inputsSnapshot: null, inventoryIncluded: false,
    shopping: { lines, subtotal: 160, tax: 0, total: 160, byKind: { wood: 160, banding: 0, hardware: 0, finish: 0 }, missing: 0 },
    warnings: ['Estimated priced total excludes items without prices. Review quantities before purchasing.']
  }
  const markup = renderToStaticMarkup(<BuildPlanShopping name="Pagination fixture" snapshot={snapshot} />)
  const assets = join(process.cwd(), 'out', 'renderer', 'assets')
  const css = readdirSync(assets).filter(name => name.endsWith('.css')).map(name => readFileSync(join(assets, name), 'utf8')).join('\n')
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body class="printing-drawings"><div class="drawings-print"><div class="packet-inner">${markup}</div></div></body></html>`
  const { app } = await launch(newDirs())
  try {
    const bytes = await app.evaluate(async ({ BrowserWindow }, content) => {
      const page = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
      try {
        await page.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`)
        await page.webContents.executeJavaScript('document.fonts.ready.then(() => true)')
        return Array.from(await page.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true }))
      } finally { page.destroy() }
    }, html)
    const output = testInfo.outputPath('long-shopping.pdf')
    writeFileSync(output, new Uint8Array(bytes))
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
    try {
      const doc = await task.promise
      expect(doc.numPages).toBeGreaterThan(2)
      const texts: string[] = []
      for (let number = 1; number <= doc.numPages; number++) {
        const page = await doc.getPage(number)
        const viewport = page.getViewport({ scale: 1 })
        const content = await page.getTextContent()
        const words: string[] = []
        for (const item of content.items) {
          if (!('str' in item)) continue
          words.push(item.str)
          if (!item.str.trim()) continue
          expect(item.transform[4]).toBeGreaterThanOrEqual(34)
          expect(item.transform[4] + item.width).toBeLessThanOrEqual(viewport.width - 34)
          expect(item.transform[5]).toBeGreaterThanOrEqual(34)
          expect(item.transform[5]).toBeLessThanOrEqual(viewport.height - 34)
        }
        const text = words.join(' ').replace(/\s+/g, ' ')
        if (/SKU\d{4}/.test(text)) {
          expect(text).toContain('Item')
          expect(text).toContain('Qty')
          expect(text).toContain('Unit price')
          expect(text).toContain('Line total')
        }
        texts.push(text)
      }
      const all = texts.join(' ')
      for (let index = 0; index < lines.length; index++) expect(all.match(new RegExp(`SKU${String(index).padStart(4, '0')}`, 'g'))).toHaveLength(1)
      expect(all).toContain('Estimated priced total')
      expect(all).toContain('$160.00')
      await testInfo.attach('long shopping PDF', { path: output, contentType: 'application/pdf' })
    } finally { await task.destroy() }
  } finally { kill(app) }
})
