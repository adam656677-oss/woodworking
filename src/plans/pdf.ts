// Reading a PDF plan: its text lines with positions and sizes, which pages are scans, and page pictures.
import type { TextLine } from './types'
import { PlanImportError } from './importError'

export { PlanImportError } from './importError'

type PdfJs = typeof import('pdfjs-dist')
let lib: Promise<PdfJs> | null = null
/** pdf.js, loaded once. In the app the worker runs from the bundled worker file. */
function pdfjs(): Promise<PdfJs> {
  if (!lib) {
    lib = (async () => {
      const m = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJs
      if (typeof window !== 'undefined' && typeof document !== 'undefined' && !m.GlobalWorkerOptions.workerSrc) {
        const url = (await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')).default
        m.GlobalWorkerOptions.workerSrc = url
      }
      return m
    })()
  }
  return lib
}

/** Where pdf.js finds its decoders for black-and-white scans (JBIG2 / CCITT), JPEG 2000 and colour profiles. */
function wasmUrl(): string {
  if (typeof document !== 'undefined' && typeof location !== 'undefined') return new URL('./pdfjs-wasm/', location.href).href
  return `file://${process.cwd().replace(/\\/g, '/')}/node_modules/pdfjs-dist/wasm/`
}

async function open(data: Uint8Array) {
  const m = await pdfjs()
  const task = m.getDocument({ data: data.slice(), useSystemFonts: true, wasmUrl: wasmUrl() } as never)
  try {
    const doc = await task.promise
    // The loading task owns the PDF's worker: destroying it frees both.
    return Object.assign(doc, { close: () => task.destroy() })
  } catch (e) {
    void task.destroy()
    throw new PlanImportError((e as { name?: string }).name === 'PasswordException' ? 'locked' : 'damaged')
  }
}

type PdfDoc = Awaited<ReturnType<typeof open>>

/** Fewer characters than this on a page means it is a picture of text (a scan). */
const SCAN_CHARS = 20

/** The text of every page as lines (top to bottom), with each line's box and text height. */
async function textLinesOf(doc: PdfDoc): Promise<{ lines: TextLine[]; scanPages: number[] }> {
  const lines: TextLine[] = []
  const scanPages: number[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const height = page.getViewport({ scale: 1 }).height
    const content = await page.getTextContent()
    type Item = { str: string; x: number; y: number; w: number; h: number }
    const items: Item[] = []
    for (const it of content.items as { str?: string; transform: number[]; width: number; height: number }[]) {
      if (typeof it.str !== 'string' || !it.str.trim()) continue
      const h = Math.abs(it.transform[3]) || it.height
      items.push({ str: it.str, x: it.transform[4], y: height - it.transform[5] - h, w: it.width, h })
    }
    if (items.reduce((a, b) => a + b.str.trim().length, 0) < SCAN_CHARS) {
      scanPages.push(n)
      continue
    }
    // Items whose baselines are within 2 points are on the same line.
    items.sort((a, b) => a.y + a.h - (b.y + b.h) || a.x - b.x)
    const rows: Item[][] = []
    for (const it of items) {
      const row = rows.find(r => Math.abs(r[0].y + r[0].h - (it.y + it.h)) <= 2)
      if (row) row.push(it)
      else rows.push([it])
    }
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x)
      let text = ''
      let end = -Infinity
      for (const it of row) {
        if (text && it.x - end > 1 && !text.endsWith(' ') && !it.str.startsWith(' ')) text += ' '
        text += it.str
        end = it.x + it.w
      }
      const x = Math.min(...row.map(r => r.x))
      const y = Math.min(...row.map(r => r.y))
      const right = Math.max(...row.map(r => r.x + r.w))
      const size = Math.max(...row.map(r => r.h))
      lines.push({ text: text.replace(/\s+/g, ' ').trim(), page: n, box: [x, y, right - x, size], size })
    }
  }
  return { lines, scanPages }
}

/** Read a PDF's text without keeping it open. */
export async function pdfTextLines(data: Uint8Array): Promise<{ lines: TextLine[]; scanPages: number[]; pageCount: number }> {
  const doc = await open(data)
  try {
    return { ...(await textLinesOf(doc)), pageCount: doc.numPages }
  } finally {
    await doc.close()
  }
}

export type OpenPdf = {
  pageCount: number
  textLines(): Promise<{ lines: TextLine[]; scanPages: number[] }>
  /** A page drawn as a PNG (in the app only; it needs a canvas). */
  render(n: number, dpi?: number): Promise<{ png: Uint8Array; scale: number }>
  /** Free the PDF and its worker. Always call when done. */
  destroy(): Promise<void>
}

/** Open a PDF once for reading its text and drawing its pages. */
export async function openPdf(data: Uint8Array): Promise<OpenPdf> {
  const doc = await open(data)
  return {
    pageCount: doc.numPages,
    textLines: () => textLinesOf(doc),
    render: (n, dpi = 150) => renderPage(doc, n, dpi),
    destroy: () => doc.close()
  }
}

async function renderPage(doc: PdfDoc, n: number, dpi: number): Promise<{ png: Uint8Array; scale: number }> {
  const page = await doc.getPage(n)
  const scale = dpi / 72
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: ctx, viewport } as never).promise
  page.cleanup()
  const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/png'))
  canvas.width = canvas.height = 0
  return { png: new Uint8Array(await blob.arrayBuffer()), scale }
}
