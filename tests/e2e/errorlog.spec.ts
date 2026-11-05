import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { kill, launch, newDirs } from './helpers'

const logFile = (userData: string) => join(userData, 'logs', 'aa-studio.log')

test('the app writes a start line, forwards page errors, and the About box opens the log folder', async () => {
  const dirs = newDirs()
  const { app, win } = await launch(dirs)
  try {
    // Start line: version, system and Electron version.
    await expect.poll(() => existsSync(logFile(dirs.userData))).toBe(true)
    const start = readFileSync(logFile(dirs.userData), 'utf8')
    expect(start).toMatch(/INFO \[app\] Started A&A Woodworking Studio 1\.0\.0 — Electron \d+/)
    expect(start).toContain(process.platform)

    // An error nothing catches in the page, and a promise nobody handled, both end up in the log.
    await win.evaluate(() => { setTimeout(() => { throw new Error('page-error-marker') }, 0) })
    await win.evaluate(() => { void Promise.reject(new Error('rejection-marker')) })
    await expect.poll(() => readFileSync(logFile(dirs.userData), 'utf8')).toContain('page-error-marker')
    await expect.poll(() => readFileSync(logFile(dirs.userData), 'utf8')).toContain('rejection-marker')
    expect(readFileSync(logFile(dirs.userData), 'utf8')).toMatch(/ERROR \[renderer\] window\.onerror: .*page-error-marker/)

    // About box: version and the log folder button (the folder opener is stubbed so nothing pops up).
    await app.evaluate(({ shell }) => {
      ;(globalThis as any).__opened = []
      shell.openPath = (async (p: string) => { (globalThis as any).__opened.push(p); return '' }) as typeof shell.openPath
    })
    await win.getByRole('button', { name: 'About', exact: true }).click()
    const dialog = win.getByRole('dialog', { name: 'About' })
    await expect(dialog).toContainText('Version 1.0.0')
    await dialog.getByRole('button', { name: 'Open log folder' }).click()
    await expect.poll(() => app.evaluate(() => (globalThis as any).__opened as string[])).toEqual([join(dirs.userData, 'logs')])
  } finally {
    kill(app)
  }
})
