// A small rotating plain-text log (no dependencies). It records what went wrong — never project contents.
// Writes are synchronous so a crash handler can still get its line onto disk, and logging never throws.
import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

export type Level = 'info' | 'warn' | 'error'
export type Logger = {
  readonly dir: string
  readonly file: string
  info(source: string, message: string): void
  warn(source: string, message: string, detail?: unknown): void
  error(source: string, message: string, detail?: unknown): void
}

export const LOG_NAME = 'aa-studio.log'
const MAX_MESSAGE = 2_000
const MAX_DETAIL = 6_000

const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}…` : s)
// eslint-disable-next-line no-control-regex
const noControls = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')

/** One entry: a dated line, then any detail (stack traces) indented underneath. */
export function formatEntry(date: Date, level: Level, source: string, message: string, detail?: string): string {
  const head = `${date.toISOString()} ${level.toUpperCase()} [${source}] ${cut(noControls(message).replace(/\s*[\r\n]+\s*/g, ' '), MAX_MESSAGE)}`
  if (!detail) return `${head}\n`
  const lines = noControls(cut(detail, MAX_DETAIL)).split(/\r?\n/).map(l => `    ${l}`)
  return `${head}\n${lines.join('\n')}\n`
}

/** Text for an error, including the system error code and the underlying cause. */
export function describeError(e: unknown): string {
  try {
    if (e === undefined || e === null) return ''
    if (!(e instanceof Error)) return String(e)
    const code = (e as NodeJS.ErrnoException).code
    const path = (e as { path?: unknown }).path
    let text = `${typeof path === 'string' ? `path: ${path}\n` : ''}${e.stack ?? `${e.name}: ${e.message}`}${code ? `\ncode: ${code}` : ''}`
    if (e.cause !== undefined) text += `\ncaused by: ${describeError(e.cause)}`
    return text
  } catch {
    return '(error details could not be read)'
  }
}

/** The only fields taken from a report sent by the page: short text, nothing else. */
export function sanitizeReport(raw: unknown): { source: string; message: string; stack?: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const source = typeof r.source === 'string' && /^[\w.:-]{1,60}$/.test(r.source) ? r.source : 'renderer'
  const message = typeof r.message === 'string' && r.message ? cut(r.message, MAX_MESSAGE) : 'Unknown error'
  const stack = typeof r.stack === 'string' && r.stack ? cut(r.stack, MAX_DETAIL) : undefined
  return stack ? { source, message, stack } : { source, message }
}

export function createLogger(opts: { dir: string; maxBytes?: number; maxFiles?: number; now?: () => Date }): Logger {
  const { dir } = opts
  const maxBytes = opts.maxBytes ?? 1_000_000
  const maxFiles = Math.max(1, opts.maxFiles ?? 5)
  const now = opts.now ?? (() => new Date())
  const file = join(dir, LOG_NAME)
  const recent = new Map<string, number>()

  const rotate = () => {
    rmSync(`${file}.${maxFiles - 1}`, { force: true })
    for (let i = maxFiles - 2; i >= 1; i--) {
      try { renameSync(`${file}.${i}`, `${file}.${i + 1}`) } catch { /* that one doesn't exist yet */ }
    }
    if (maxFiles > 1) renameSync(file, `${file}.1`)
    else rmSync(file, { force: true })
  }

  const write = (level: Level, source: string, message: string, detail?: unknown) => {
    try {
      const at = now()
      // A problem that repeats every few seconds (a failing autosave) is noted once a minute, not thousands of times.
      const key = `${level}|${source}|${message}`
      const last = recent.get(key)
      if (last !== undefined && at.getTime() - last < 60_000) return
      recent.set(key, at.getTime())
      if (recent.size > 200) recent.clear()
      const entry = formatEntry(at, level, source, String(message), detail === undefined ? undefined : describeError(detail))
      mkdirSync(dir, { recursive: true })
      let size = 0
      try { size = statSync(file).size } catch { /* no file yet */ }
      if (size > 0 && size + Buffer.byteLength(entry) > maxBytes) rotate()
      appendFileSync(file, entry, 'utf8')
    } catch {
      // The log must never be the thing that breaks the app.
    }
  }

  return {
    dir,
    file,
    info: (source, message) => write('info', source, message),
    warn: (source, message, detail) => write('warn', source, message, detail),
    error: (source, message, detail) => write('error', source, message, detail)
  }
}
