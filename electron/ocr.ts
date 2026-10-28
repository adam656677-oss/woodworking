// Reading text from photos and scanned pages, on this computer (Tesseract with bundled English data).
import { join } from 'node:path'
import { createWorker, type Worker } from 'tesseract.js'
import type { TextLine } from '../src/plans/types'

/** Words the reader is less sure of than this (0–100) are marked uncertain. */
const SURE = 60

let paths = {
  /** The folder holding eng.traineddata.gz (shipped with the app, never downloaded). */
  langPath: join(process.cwd(), 'node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int')
}
let worker: Promise<Worker> | null = null

/** Point the reader at its data when the app is installed (outside the packed archive). */
export function configureOcr(p: { langPath: string }): void {
  paths = p
}

function getWorker(): Promise<Worker> {
  if (!worker) worker = createWorker('eng', 1, { langPath: paths.langPath, cacheMethod: 'none', gzip: true })
  return worker
}

export async function stopOcr(): Promise<void> {
  const w = worker
  worker = null
  if (w) await (await w).terminate()
}

type Word = { text: string; confidence: number }
type Line = { text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; words: Word[] }

/** Read one picture of a page into text lines with boxes; doubtful words are listed per line. */
export async function ocrImage(bytes: Uint8Array, page: number): Promise<TextLine[]> {
  const w = await getWorker()
  const { data } = await w.recognize(Buffer.from(bytes), {}, { blocks: true, text: false })
  const lines: Line[] = []
  for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) lines.push(l as unknown as Line)
  return lines
    .map(l => {
      const text = l.text.replace(/\s+/g, ' ').trim()
      const uncertain = l.words.filter(wd => wd.confidence < SURE).map(wd => wd.text)
      const { x0, y0, x1, y1 } = l.bbox
      const line: TextLine = { text, page, box: [x0, y0, x1 - x0, y1 - y0], size: y1 - y0 }
      if (uncertain.length) line.uncertain = uncertain
      return line
    })
    .filter(l => l.text.length > 0)
}
