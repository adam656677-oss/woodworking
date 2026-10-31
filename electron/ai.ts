// The online Smart Helpers: the user's own Anthropic API key, kept encrypted with Windows' own protection, and the
// three requests the helpers make. Nothing is sent unless there is a key and the user presses a helper's button.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { safeSave } from './fileStore'

export type Crypt = { isEncryptionAvailable(): boolean; encryptString(s: string): Buffer; decryptString(b: Buffer): string }
export type AiSettings = { model: string }
export const DEFAULT_MODEL = 'claude-sonnet-5-5'
const KEY_FILE = 'ai-key.bin', SETTINGS_FILE = 'ai-settings.json'

export async function readKey(dir: string, crypt: Crypt): Promise<string | null> {
  try {
    const text = (await readFile(join(dir, KEY_FILE), 'utf8')).trim()
    return text ? crypt.decryptString(Buffer.from(text, 'base64')) || null : null
  } catch { return null }
}
export async function writeKey(dir: string, crypt: Crypt, key: string | null): Promise<void> {
  if (key === null || !key.trim()) { await safeSave(join(dir, KEY_FILE), ''); return }
  if (!crypt.isEncryptionAvailable()) throw new Error("This computer can't store the key safely, so it wasn't saved.")
  if (!/^sk-ant-[A-Za-z0-9_-]{10,}$/.test(key.trim())) throw new Error("That doesn't look like an Anthropic API key (they start with sk-ant-).")
  // safeSave writes text: the encrypted key goes in as base64.
  await safeSave(join(dir, KEY_FILE), crypt.encryptString(key.trim()).toString('base64'))
}
export async function readSettings(dir: string): Promise<AiSettings> {
  try { const v = JSON.parse(await readFile(join(dir, SETTINGS_FILE), 'utf8')); if (typeof v?.model === 'string' && v.model) return { model: v.model } } catch { /* defaults */ }
  return { model: DEFAULT_MODEL }
}
export const writeSettings = (dir: string, s: AiSettings) => safeSave(join(dir, SETTINGS_FILE), JSON.stringify({ model: s.model.trim() || DEFAULT_MODEL }))

export type Task =
  | { task: 'photoPlan'; image: string; known: string }
  | { task: 'woodId'; image: string }
  | { task: 'describe'; text: string; templates: string }

const SPACE = 'Inches. World axes: x left→right, y front→back, z up; x, y, z are the part\'s lowest corner. Each part has width, length and thickness (thickness is the smallest), and "lies": one of flat-x (lying flat, length along x), flat-y, wall-x (standing like a front panel: length along x, width up), wall-y, upright-x (length up, width along x), upright-y.'
const PLAN = '{"name": string, "parts": [{"name": string, "width": number, "length": number, "thickness": number, "x": number, "y": number, "z": number, "lies": string}], "steps": [string]}'

export function buildRequest(t: Task, model: string): { model: string; max_tokens: number; system: string; messages: unknown[] } {
  const image = (data: string) => {
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(data)
    if (!m) throw new Error("That picture couldn't be sent.")
    return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }
  }
  const json = 'Answer with JSON only, no other text.'
  if (t.task === 'photoPlan') return {
    model, max_tokens: 8000,
    system: `You turn a photo of a piece of furniture into a woodworking design made of rectangular wooden parts, for a home woodworker to check and correct. ${SPACE} Use common lumber thicknesses (3/4" boards and plywood, 1-1/2" for 2x lumber, 1-3/4" legs). Give short, plain build steps in order. ${json} Shape: ${PLAN}`,
    messages: [{ role: 'user', content: [image(t.image), { type: 'text', text: `Known measurement: ${t.known.slice(0, 100)}. Break the piece into its parts.` }] }]
  }
  if (t.task === 'woodId') return {
    model, max_tokens: 800,
    system: `You identify wood species from a photo of a board for a home woodworker. Give up to three guesses, most likely first, as species names (common North American names). For each say how sure ("likely", "maybe" or "unsure") and what to look at to tell (grain, pores, colour, smell, weight). ${json} Shape: {"guesses": [{"species": string, "sure": string, "look": string}]}`,
    messages: [{ role: 'user', content: [image(t.image), { type: 'text', text: 'What wood is this?' }] }]
  }
  return {
    model, max_tokens: 8000,
    system: `You turn a description of a woodworking project into a starting design. If one of these templates fits, answer {"template": id, "params": {key: value}} using only its keys:\n${t.templates.slice(0, 6000)}\nOtherwise answer a list of parts. ${SPACE} ${json} Parts shape: ${PLAN}`,
    messages: [{ role: 'user', content: [{ type: 'text', text: t.text.slice(0, 2000) }] }]
  }
}

const UNREADABLE = "The helper's answer couldn't be read. Try again."

/** The first whole JSON value in some text (strings may hold brackets; anything after it is ignored). */
function firstJson(text: string): string | null {
  const start = text.search(/[[{]/)
  if (start < 0) return null
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue }
    if (c === '"') inStr = true
    else if (c === '{' || c === '[') depth++
    else if (c === '}' || c === ']') { if (--depth === 0) return text.slice(start, i + 1) }
  }
  return null
}

/** The JSON in the model's answer (it may come wrapped in a code fence, or with words around it). */
export function answerJson(body: any): unknown {
  if (body?.stop_reason === 'max_tokens') throw new Error('The helper ran out of room before it finished (the piece may be too complicated). Try a simpler piece or a closer photo.')
  const text: string = Array.isArray(body?.content) ? body.content.filter((c: any) => c?.type === 'text' && typeof c.text === 'string').map((c: any) => c.text).join('') : ''
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const raw = firstJson(m ? m[1] : text)
  if (!raw) throw new Error(UNREADABLE)
  try { return JSON.parse(raw) } catch { throw new Error(UNREADABLE) }
}

/** The most of an answer that's read (a real one is a few kilobytes). */
const MAX_BODY = 1_000_000

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return await res.text()
  const reader = res.body.getReader()
  const parts: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY) { void reader.cancel(); throw new Error('The helper\'s answer was too long to use. Try again.') }
    parts.push(value)
  }
  return Buffer.concat(parts).toString('utf8')
}

/** Sends one request; plain messages for the usual problems. The time limit covers reading the whole answer. */
export async function ask(t: Task, key: string, model: string, base = 'https://api.anthropic.com', fetchFn: typeof fetch = fetch, timeoutMs = 90_000): Promise<unknown> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  const slow = (e: unknown) => (e as Error)?.name === 'AbortError' || ctl.signal.aborted
  try {
    let res: Response
    try {
      res = await fetchFn(`${base}/v1/messages`, {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(buildRequest(t, model))
      })
    } catch (e) {
      throw new Error(slow(e) ? 'The helper took too long to answer. Try again.' : "Couldn't reach the online helper. Check the internet connection.")
    }
    if (!res.ok) void res.body?.cancel().catch(() => {})
    if (res.status === 401 || res.status === 403) throw new Error('The API key was refused. Check it in Smart Helpers settings.')
    if (res.status === 404) throw new Error("The model name in Smart Helpers settings wasn't found. Put it back to the default (" + DEFAULT_MODEL + ').')
    if (res.status === 413) throw new Error('That picture is too big to send. Try a smaller photo.')
    if (res.status === 429 || res.status === 529) throw new Error('The helper is busy or the account has hit its limit. Try again in a minute.')
    if (res.status === 400) throw new Error("The helper couldn't use that request (the picture may be too big, or the model name is wrong in settings).")
    if (!res.ok) throw new Error(`The online helper had a problem (${res.status}). Try again later.`)
    let text: string
    try { text = await readCapped(res) } catch (e) {
      if (slow(e)) throw new Error('The helper took too long to answer. Try again.')
      throw e instanceof Error && /too long to use/.test(e.message) ? e : new Error(UNREADABLE)
    }
    let body: unknown
    try { body = JSON.parse(text) } catch { throw new Error(UNREADABLE) }
    return answerJson(body)
  } finally { clearTimeout(timer) }
}
