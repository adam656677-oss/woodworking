const { _electron: electron, expect } = require('@playwright/test')
const fs = require('node:fs')
const { join, resolve } = require('node:path')
const { tmpdir } = require('node:os')
const { spawnSync } = require('node:child_process')

async function main() {
  const executablePath = process.env.AA_INSTALLED_EXE
  if (!executablePath || !fs.existsSync(executablePath)) throw new Error('Installed executable required')
  const root = fs.mkdtempSync(join(tmpdir(), 'aa-installed-'))
  const output = resolve('installed-test-results')
  fs.mkdirSync(output, { recursive: true })
  const docs = join(root, 'docs'), userData = join(root, 'user-data')
  fs.mkdirSync(docs); fs.mkdirSync(userData)
  const project = join(docs, 'Installed verification.aaw'), pdf = join(output, 'installed-plan.pdf')
  let app
  const launch = async () => {
    app = await electron.launch({ executablePath, env: { ...process.env, AA_DOCS_DIR: docs, AA_USER_DATA: userData } })
    const win = await app.firstWindow()
    win.setDefaultTimeout(30000)
    return win
  }
  try {
    let win = await launch()
    await expect(win.getByRole('button', { name: /Master Shop/ })).toBeVisible()
    await win.screenshot({ path: join(output, 'dashboard.png') })
    await win.getByRole('button', { name: /Master Shop/ }).click()
    await win.getByRole('button', { name: 'New ▾' }).click()
    await win.getByRole('menuitem', { name: 'Box', exact: true }).click()
    const parts = win.getByRole('list', { name: 'Parts', exact: true })
    await expect(parts).toBeVisible()
    const names = (await parts.textContent()) ?? ""
    await win.screenshot({ path: join(output, 'designer.png') })
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }) }, project)
    await win.getByRole('button', { name: 'Save', exact: true }).click()
    await expect.poll(() => fs.existsSync(project)).toBe(true)
    await win.getByRole('button', { name: 'Create Build Plan', exact: true }).click()
    const preview = win.getByRole('dialog', { name: 'Build plan preview' })
    const shopping = preview.getByRole('region', { name: 'Build plan shopping list' })
    await expect(shopping).toBeAttached({ timeout: 60000 })
    await preview.getByTestId('build-plan-sheet').first().screenshot({ path: join(output, 'plan-cover.png') })
    await shopping.screenshot({ path: join(output, 'shopping.png') })
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }) }, pdf)
    await preview.getByRole('button', { name: 'Save as PDF', exact: true }).click()
    await expect(preview.getByRole('status')).toHaveText('Build plan saved as PDF.', { timeout: 60000 })
    const bytes = fs.readFileSync(pdf)
    if (bytes.subarray(0, 5).toString() !== '%PDF-' || bytes.length < 1000) throw new Error('Invalid installed PDF export')
    await preview.getByRole('button', { name: 'Back to Design', exact: true }).click()
    await app.close(); app = null
    win = await launch()
    await win.getByRole('button', { name: /Master Shop/ }).click()
    await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }) }, project)
    await win.getByRole('button', { name: 'Open', exact: true }).click()
    await expect(win.getByRole('list', { name: 'Parts', exact: true })).toHaveText(names)
    await win.screenshot({ path: join(output, 'reopened-project.png') })
    fs.writeFileSync(join(output, 'result.json'), JSON.stringify({ passed: true, checks: ['installed launch', 'template creation', 'project save', 'shopping preview', 'PDF export', 'project reopen'] }, null, 2))
    await app.close(); app = null
  } catch (error) {
    fs.writeFileSync(join(output, 'failure.txt'), error.stack || String(error))
    throw error
  } finally {
    if (app && app.process().pid) spawnSync('taskkill', ['/PID', String(app.process().pid), '/T', '/F'], { timeout: 10000, windowsHide: true })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
