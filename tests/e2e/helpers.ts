import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Software WebGL so the 3D view runs on machines without a GPU (CI, cloud VMs).
const GL = process.platform === 'linux' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []

export type Dirs = { docs: string; userData: string }
export const newDirs = (): Dirs => ({ docs: mkdtempSync(join(tmpdir(), 'aa-docs-')), userData: mkdtempSync(join(tmpdir(), 'aa-ud-')) })

export async function launch(dirs: Dirs): Promise<{ app: ElectronApplication; win: Page }> {
  const app = await electron.launch({
    args: ['.', '--no-sandbox', ...GL],
    env: { ...process.env, AA_DOCS_DIR: dirs.docs, AA_USER_DATA: dirs.userData }
  })
  const win = await app.firstWindow()
  win.setDefaultTimeout(15_000)
  return { app, win }
}

/** Kill without the "save changes?" prompt. */
export function kill(app: ElectronApplication) {
  app.process().kill('SIGKILL')
}

export async function stubSaveDialog(app: ElectronApplication, filePath: string) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: p })) as typeof dialog.showSaveDialog
  }, filePath)
}

export async function stubOpenDialog(app: ElectronApplication, filePath: string) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as typeof dialog.showOpenDialog
  }, filePath)
}

export async function enterMasterShop(win: Page) {
  await win.getByRole('button', { name: /Master Shop/ }).click()
}

export async function startTemplate(win: Page, name: 'Box' | 'Bookshelf' | 'Birdhouse') {
  await win.getByRole('button', { name: 'New ▾' }).click()
  await win.getByRole('menuitem', { name }).click()
}

/** Open the cut list and return each row's cells as text. */
export async function cutListRows(win: Page): Promise<string[][]> {
  await win.getByRole('button', { name: 'Cut List' }).click()
  const dialog = win.getByRole('dialog', { name: 'Cut list' })
  await expect(dialog).toBeVisible()
  const rows = await dialog.locator('tbody tr').evaluateAll(trs =>
    trs.map(tr => Array.from(tr.querySelectorAll('td')).map(td => (td as HTMLElement).innerText.trim()))
  )
  await dialog.getByRole('button', { name: 'Close' }).click()
  return rows
}

export async function typeInches(win: Page, label: string, value: string) {
  const input = win.getByLabel(label, { exact: true })
  await input.fill(value)
  await input.press('Enter')
}

export function part(win: Page, name: string, nth = 0) {
  return win.getByRole('list', { name: 'Parts' }).getByRole('listitem').filter({ hasText: new RegExp(`^(⚠ )?${name}`) }).nth(nth)
}
