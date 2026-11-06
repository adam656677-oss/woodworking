import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLogger, formatEntry, sanitizeReport } from '../../electron/logger'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'aa-log-'))
})

test('formatEntry writes one dated, labelled line and indents extra lines', () => {
  const line = formatEntry(new Date('2026-11-05T12:00:00.000Z'), 'error', 'main', 'Save failed', 'Error: boom\n  at x')
  expect(line).toBe('2026-11-05T12:00:00.000Z ERROR [main] Save failed\n    Error: boom\n      at x\n')
})

test('formatEntry flattens line breaks in the message and drops control characters', () => {
  const line = formatEntry(new Date(0), 'info', 'app', 'a\r\nb\u0007c')
  expect(line).toBe('1970-01-01T00:00:00.000Z INFO [app] a b c\n')
})

test('formatEntry cuts very long text', () => {
  const line = formatEntry(new Date(0), 'warn', 'app', 'x'.repeat(10_000), 'y'.repeat(20_000))
  expect(line.length).toBeLessThan(9_000)
  expect(line).toContain('…')
})

test('the log file is created in the folder and entries are appended', async () => {
  const log = createLogger({ dir: join(dir, 'logs') })
  log.info('app', 'one')
  log.error('main', 'two', new Error('bad thing'))
  const text = await readFile(join(dir, 'logs', 'aa-studio.log'), 'utf8')
  expect(text).toMatch(/INFO \[app\] one\n/)
  expect(text).toMatch(/ERROR \[main\] two/)
  expect(text).toContain('Error: bad thing')
})

test('error details include the underlying cause and system code', async () => {
  const log = createLogger({ dir })
  const cause = Object.assign(new Error('no space left'), { code: 'ENOSPC' })
  log.error('save', 'Could not save C:\\Docs\\Box.aaw', new Error("Couldn't save", { cause }))
  const text = await readFile(join(dir, 'aa-studio.log'), 'utf8')
  expect(text).toContain('ENOSPC')
  expect(text).toContain('no space left')
})

test('rotation: a full file moves to .1 and only five files are kept', async () => {
  const log = createLogger({ dir, maxBytes: 500, maxFiles: 5 })
  for (let i = 0; i < 60; i++) log.info('app', `entry ${i} ${'z'.repeat(60)}`)
  const names = (await readdir(dir)).sort()
  expect(names).toEqual(['aa-studio.log', 'aa-studio.log.1', 'aa-studio.log.2', 'aa-studio.log.3', 'aa-studio.log.4'])
  const current = await readFile(join(dir, 'aa-studio.log'), 'utf8')
  const newest = await readFile(join(dir, 'aa-studio.log.1'), 'utf8')
  expect(current).toContain('entry 59')
  expect(newest).not.toContain('entry 59')
  // Each file stays near the limit (one entry may overshoot).
  for (const n of names) expect((await readFile(join(dir, n), 'utf8')).length).toBeLessThan(500 + 200)
  // The oldest entries are gone.
  const all = (await Promise.all(names.map(n => readFile(join(dir, n), 'utf8')))).join('')
  expect(all).not.toContain('entry 0 ')
})

test('a new run keeps adding to the existing file', async () => {
  createLogger({ dir }).info('app', 'first run')
  createLogger({ dir }).info('app', 'second run')
  const text = await readFile(join(dir, 'aa-studio.log'), 'utf8')
  expect(text.indexOf('first run')).toBeLessThan(text.indexOf('second run'))
})

test('logging never throws when the folder cannot be written', async () => {
  const blocker = join(dir, 'not-a-folder')
  await writeFile(blocker, 'x')
  const log = createLogger({ dir: join(blocker, 'logs') })
  expect(() => {
    log.info('app', 'hello')
    log.error('main', 'bad', new Error('x'))
    log.error('main', 'circular', { toString() { throw new Error('no') } })
  }).not.toThrow()
})

test('the same message repeated in a burst is written once', async () => {
  const log = createLogger({ dir })
  for (let i = 0; i < 5; i++) log.error('autosave', 'Could not write autosave')
  const text = await readFile(join(dir, 'aa-studio.log'), 'utf8')
  expect(text.match(/Could not write autosave/g)).toHaveLength(1)
})

test('sanitizeReport keeps only known text fields and trims them', () => {
  expect(sanitizeReport({ source: 'window.onerror', message: 'oops', stack: 'at a', extra: 'secret', project: { boards: [] } }))
    .toEqual({ source: 'window.onerror', message: 'oops', stack: 'at a' })
  expect(sanitizeReport(null)).toEqual({ source: 'renderer', message: 'Unknown error' })
  expect(sanitizeReport({ source: 'x'.repeat(500), message: 42 as unknown as string }).source.length).toBeLessThanOrEqual(60)
  expect(sanitizeReport({ source: 'bad source!', message: 'm' }).source).toBe('renderer')
})
