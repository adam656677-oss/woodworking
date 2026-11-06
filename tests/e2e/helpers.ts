import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
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
  try {
    const win = await app.firstWindow()
    // A cold start on a busy CI machine can take longer than one click's timeout; wait for the app to draw first.
    await win.waitForSelector('#root > *', { timeout: 60_000 })
    win.setDefaultTimeout(15_000)
    return { app, win }
  } catch (error) {
    kill(app)
    throw error
  }
}

/** Terminate this test's Electron tree without a save-changes prompt. */
export function kill(app: ElectronApplication) {
  const child = app.process()
  if (process.platform === 'win32' && child.pid && child.exitCode === null && child.signalCode === null) {
    const result = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true, timeout: 10_000, encoding: 'utf8'
    })
    if (result.error || result.status !== 0) {
      console.warn('Electron process-tree cleanup was not confirmed:', result.error?.message ?? result.stderr.trim())
      child.kill('SIGKILL')
    }
    return
  }
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
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

export async function selectInspectorTab(win: Page, name: 'Properties' | 'Template' | 'References' | 'Checks') {
  const inspector = win.getByRole('complementary', { name: 'Inspector', exact: true })
  const tab = inspector.getByRole('tab', { name, exact: true })
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
}

export async function startTemplate(win: Page, name: 'Box' | 'Bookshelf' | 'Birdhouse') {
  await win.getByRole('button', { name: 'New ▾' }).click()
  await win.getByRole('menuitem', { name }).click()
  await selectInspectorTab(win, 'Template')
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
  // Reveal an Inspector field through its real tab, never by forcing a hidden control.
  const panel = input.locator('xpath=ancestor::*[@role="tabpanel"][1]')
  if (await panel.count() === 1 && !(await input.isVisible())) {
    const panelId = await panel.getAttribute('id')
    if (panelId) await win.locator(`[role="tab"][aria-controls="${panelId}"]`).click()
  }
  // Retry only the fill if a model update lands during typing.
  await expect(async () => {
    await input.fill(value)
    await expect(input).toHaveValue(value, { timeout: 300 })
  }).toPass({ timeout: 5000 })
  await input.press('Enter')
}

export function part(win: Page, name: string, nth = 0) {
  return win.getByRole('list', { name: 'Parts' }).getByRole('listitem').filter({ hasText: new RegExp(`^(⚠ )?${name}`) }).nth(nth)
}

/** Unlock through the Template tab, then expose the free-form part controls. */
export async function unlockTemplate(win: Page) {
  await selectInspectorTab(win, 'Template')
  await win.getByRole('button', { name: 'Unlock for free-form editing' }).click()
  await win.getByRole('button', { name: 'Unlock', exact: true }).click()
  await selectInspectorTab(win, 'Properties')
}
