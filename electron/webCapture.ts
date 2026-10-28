// Bringing in a plan from a web address: a link straight to a PDF is fetched as that PDF; any other
// page is opened once in a hidden, silent window with no pop-ups and no saved cookies, and printed to PDF.
import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'

type Deps = {
  fetcher: (url: string) => Promise<Response>
  makeWindow: (opts: BrowserWindowConstructorOptions) => BrowserWindow
}

const LIMIT_MS = 30_000
const fail = () => new Error('web')

function withLimit<T>(p: Promise<T>): Promise<T> {
  return Promise.race([p, new Promise<T>((_r, reject) => setTimeout(() => reject(fail()), LIMIT_MS))])
}

export async function capturePage(url: string, deps: Deps): Promise<Uint8Array> {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    throw fail()
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw fail()

  // A plan site's "Download PDF" link: use the file itself.
  try {
    const res = await withLimit(deps.fetcher(parsed.href))
    if (res.ok) {
      const type = res.headers.get('content-type') ?? ''
      const bytes = new Uint8Array(await res.arrayBuffer())
      const isPdf = /application\/pdf/i.test(type) || (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)
      if (isPdf) return bytes
    }
  } catch {
    // Some sites refuse plain requests; the page window below still gets a chance.
  }

  const win = deps.makeWindow({
    show: false,
    width: 1100,
    height: 1400,
    webPreferences: { sandbox: true, javascript: true, partition: `plans-capture-${Date.now()}`, nodeIntegration: false, contextIsolation: true }
  })
  try {
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.setAudioMuted(true)
    // Never let the page navigate to a file or app link, or start a download (and its Save dialog).
    win.webContents.on('will-navigate', (e, to) => {
      if (!/^https?:/i.test(to)) e.preventDefault()
    })
    win.webContents.session.on('will-download', (_e, item) => item.cancel())
    await withLimit(win.loadURL(parsed.href))
    return new Uint8Array(await win.webContents.printToPDF({ pageSize: 'Letter', printBackground: false }))
  } catch {
    throw fail()
  } finally {
    win.destroy()
  }
}
