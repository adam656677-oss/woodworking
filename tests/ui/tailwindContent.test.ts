import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
// @ts-expect-error the Tailwind config is plain JavaScript
import config from '../../tailwind.config.js'

// Styles are generated only for files Tailwind scans; a screen outside that list renders unstyled.
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? tsxFiles(p) : p.endsWith('.tsx') ? [p] : []
  })
}

test('every component file is scanned for styles', () => {
  const globs: string[] = config.content
  const covered = (file: string) => globs.some(g => {
    const base = g.replace(/^\.\//, '').split('/**')[0]
    return relative(process.cwd(), file).startsWith(base + '/')
  })
  const missed = tsxFiles(join(process.cwd(), 'src')).filter(f => !covered(f)).map(f => relative(process.cwd(), f))
  expect(missed).toEqual([])
})
