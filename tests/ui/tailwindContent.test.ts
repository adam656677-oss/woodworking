import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
// @ts-expect-error the Tailwind config is plain JavaScript
import config from '../../tailwind.config.js'

// Styles are generated only for files Tailwind scans.
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? tsxFiles(p) : p.endsWith('.tsx') ? [p] : []
  })
}

const posixPath = (path: string) => path.replace(/\\/g, '/').replace(/^\.\//, '')
function coveredByContentRoot(file: string, globs: string[]): boolean {
  const normalized = posixPath(file)
  return globs.some(glob => {
    const base = posixPath(glob).split('/**')[0]
    return normalized.startsWith(base + '/')
  })
}

test('every component file is scanned for styles', () => {
  const globs: string[] = config.content
  const missed = tsxFiles(join(process.cwd(), 'src'))
    .map(file => relative(process.cwd(), file))
    .filter(file => !coveredByContentRoot(file, globs))
  expect(missed).toEqual([])
})

test('style coverage recognizes Windows and POSIX separators equally', () => {
  const globs = ['./src/ui/**/*.{ts,tsx}', './src/shop/**/*.tsx']
  expect(coveredByContentRoot('src/ui/designer/Designer.tsx', globs)).toBe(true)
  expect(coveredByContentRoot('src\\ui\\designer\\Designer.tsx', globs)).toBe(true)
  expect(coveredByContentRoot('src\\shop\\ui\\ShopMode.tsx', globs)).toBe(true)
  expect(coveredByContentRoot('src/ui-other/Outside.tsx', globs)).toBe(false)
  expect(coveredByContentRoot('src/uncovered/Outside.tsx', globs)).toBe(false)
})
