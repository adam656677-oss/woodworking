import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { answerJson, ask, buildRequest, DEFAULT_MODEL, readKey, readSettings, writeKey, writeSettings, type Crypt } from '../../electron/ai'

// A stand-in for Windows' protection that makes bytes outside plain text, as the real one does.
const crypt: Crypt = { isEncryptionAvailable: () => true, encryptString: s => Buffer.from([...Buffer.from(s)].map(b => b ^ 0xa5)), decryptString: b => Buffer.from([...b].map(x => x ^ 0xa5)).toString() }
const IMG = 'data:image/jpeg;base64,AAAA'

test('the key is kept encrypted and read back; a bad key or no safe storage is refused', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aa-ai-'))
  expect(await readKey(dir, crypt)).toBeNull()
  await writeKey(dir, crypt, 'sk-ant-api03-abcdefghijklmnop')
  expect(await readKey(dir, crypt)).toBe('sk-ant-api03-abcdefghijklmnop')
  await expect(writeKey(dir, crypt, 'hello')).rejects.toThrow(/Anthropic/)
  await expect(writeKey(dir, { ...crypt, isEncryptionAvailable: () => false }, 'sk-ant-api03-abcdefghijklmnop')).rejects.toThrow(/safely/)
  await writeKey(dir, crypt, null)
  expect(await readKey(dir, crypt)).toBeNull()
  expect(await readSettings(dir)).toEqual({ model: DEFAULT_MODEL })
  await writeSettings(dir, { model: 'claude-opus-5-5' })
  expect(await readSettings(dir)).toEqual({ model: 'claude-opus-5-5' })
})

test('requests carry only the picture or the words, with the model', () => {
  const r = buildRequest({ task: 'photoPlan', image: IMG, known: 'height 30' }, 'm')
  expect(r.model).toBe('m')
  expect(JSON.stringify(r.messages)).toContain('"media_type":"image/jpeg"')
  expect(JSON.stringify(r.messages)).toContain('height 30')
  expect(() => buildRequest({ task: 'woodId', image: 'javascript:1' }, 'm')).toThrow()
  expect(buildRequest({ task: 'describe', text: 'a box', templates: 'box' }, 'm').system).toContain('template')
})

test('the answer is read even inside a code fence', () => {
  expect(answerJson({ content: [{ type: 'text', text: 'Here:\n```json\n{"a":1}\n```' }] })).toEqual({ a: 1 })
  expect(answerJson({ content: [{ type: 'text', text: '{"guesses":[]}' }] })).toEqual({ guesses: [] })
  expect(() => answerJson({ content: [{ type: 'text', text: 'sorry' }] })).toThrow()
})

test('plain messages for a refused key, a busy service and no internet', async () => {
  const reply = (status: number, body: unknown = {}) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
  const t = { task: 'woodId' as const, image: IMG }
  await expect(ask(t, 'k', 'm', 'http://x', reply(401))).rejects.toThrow(/refused/)
  await expect(ask(t, 'k', 'm', 'http://x', reply(429))).rejects.toThrow(/busy/)
  await expect(ask(t, 'k', 'm', 'http://x', (async () => { throw new TypeError('fetch failed') }) as unknown as typeof fetch)).rejects.toThrow(/internet/)
  let sent: any
  const ok = (async (_u: string, init: any) => { sent = JSON.parse(init.body); return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"guesses":[{"species":"red-oak"}]}' }] }), { status: 200 }) }) as unknown as typeof fetch
  expect(await ask(t, 'k', 'm', 'http://x', ok)).toEqual({ guesses: [{ species: 'red-oak' }] })
  expect(sent.model).toBe('m')
})
