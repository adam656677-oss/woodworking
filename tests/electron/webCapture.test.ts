import { capturePage } from '../../electron/webCapture'

function fakeWindowFactory() {
  const made: any[] = []
  const factory = (opts: any) => {
    const w = {
      opts,
      denied: false,
      muted: false,
      destroyed: false,
      webContents: {
        setWindowOpenHandler: (h: () => { action: string }) => { w.denied = h().action === 'deny' },
        setAudioMuted: (m: boolean) => { w.muted = m },
        on: () => {},
        session: { on: () => {} },
        printToPDF: async () => Buffer.from('%PDF-1.7 page')
      },
      loadURL: async () => {},
      destroy: () => { w.destroyed = true }
    }
    made.push(w)
    return w as any
  }
  return { made, factory }
}

test('a link straight to a PDF is brought in as that PDF, without opening a page', async () => {
  const { made, factory } = fakeWindowFactory()
  const fetcher = async () => new Response(new Uint8Array([37, 80, 68, 70, 45, 49]), { headers: { 'content-type': 'application/pdf' } })
  const bytes = await capturePage('https://plans.example.com/stool.pdf', { fetcher, makeWindow: factory })
  expect(Buffer.from(bytes).toString('latin1').startsWith('%PDF')).toBe(true)
  expect(made).toHaveLength(0)
})

test('a web page opens hidden, silent, with pop-ups blocked and no saved cookies, then is closed', async () => {
  const { made, factory } = fakeWindowFactory()
  const fetcher = async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
  const bytes = await capturePage('https://plans.example.com/stool', { fetcher, makeWindow: factory })
  expect(Buffer.from(bytes).toString('latin1')).toContain('%PDF')
  const w = made[0]
  expect(w.opts.show).toBe(false)
  expect(w.opts.webPreferences.partition).toMatch(/^plans-capture-/)
  expect(w.denied).toBe(true)
  expect(w.muted).toBe(true)
  expect(w.destroyed).toBe(true)
})

test('only http and https addresses are opened', async () => {
  const { factory } = fakeWindowFactory()
  await expect(capturePage('file:///C:/secret.txt', { fetcher: async () => new Response(''), makeWindow: factory })).rejects.toThrow('web')
  await expect(capturePage('javascript:alert(1)', { fetcher: async () => new Response(''), makeWindow: factory })).rejects.toThrow('web')
})
