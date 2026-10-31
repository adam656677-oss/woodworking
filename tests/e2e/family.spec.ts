import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs, stubOpenDialog, stubSaveDialog } from './helpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }

test('family: a second child with their own progress; back up, change, restore; share a project and open it', async () => {
  const dirs = newDirs()
  const { app, win } = await launch(dirs)
  try {
    // The parent sets up Sam, then adds Riley.
    await win.getByRole('button', { name: /Kids' Workshop/ }).click()
    await win.getByRole('button', { name: 'Parent' }).click()
    await win.getByLabel("Child's first name").fill('Sam')
    await win.getByLabel('New PIN').fill('1234')
    await win.getByLabel('PIN again').fill('1234')
    await win.getByRole('button', { name: 'Save PIN' }).click()
    const family = win.getByRole('region', { name: 'Family' })
    await expect(family).toContainText('Sam')
    await family.getByLabel("New child's first name").fill('Riley')
    await family.getByRole('button', { name: 'Add a child' }).click()
    await expect(family.locator('tbody tr')).toHaveCount(2)
    await shot(win, 'family-dashboard')
    await win.getByRole('button', { name: '← Back' }).click()

    // Sam opens a lesson; Riley's path is fresh.
    const who = win.getByRole('radiogroup', { name: "Who's working?" })
    await expect(who.getByRole('radio', { name: 'Sam' })).toHaveAttribute('aria-checked', 'true')
    await expect(win.getByText('Hi, Sam!', { exact: false })).toBeVisible()
    await who.getByRole('radio', { name: 'Riley' }).click()
    await expect(win.getByText('Hi, Riley!', { exact: false })).toBeVisible()
    await who.getByRole('radio', { name: 'Sam' }).click()
    await expect(win.getByText('Hi, Sam!', { exact: false })).toBeVisible()
    await win.getByRole('button', { name: '← Home' }).click()

    // Back up everything.
    const backup = join(dirs.docs, 'family.aabackup')
    await stubSaveDialog(app, backup)
    await win.getByRole('button', { name: '💾 Back up everything…' }).click()
    await expect(win.getByRole('status')).toContainText('Backed up')
    expect(existsSync(backup)).toBe(true)

    // Change something (Riley's name in the profile list), then restore.
    const profiles = join(dirs.userData, 'kids-profiles.json')
    const before = readFileSync(profiles, 'utf8')
    writeFileSync(profiles, before.replace('Riley', 'Changed'))
    await stubOpenDialog(app, backup)
    await win.getByRole('button', { name: 'Restore from a backup…' }).click()
    await win.getByLabel('Parent PIN').fill('1234')
    await win.getByRole('button', { name: 'Choose the backup file…' }).click()
    await expect(win.getByRole('status')).toContainText('Restored')
    await expect.poll(() => readFileSync(profiles, 'utf8')).toContain('Riley')

    // Share a project, then open the package.
    await win.waitForTimeout(2000)
    await enterMasterShop(win)
    await win.getByRole('button', { name: 'Bookshelf', exact: true }).click()
    const pkg = join(dirs.docs, 'shelf.aapkg')
    await stubSaveDialog(app, pkg)
    await win.getByRole('button', { name: 'Share ▾' }).click()
    await win.getByRole('menuitem', { name: 'Share this project…' }).click()
    const dlg = win.getByRole('dialog', { name: 'Share this project' })
    await dlg.getByLabel('From').fill('Adam')
    await dlg.getByLabel('Note').fill('Try it in oak')
    await dlg.getByRole('button', { name: 'Save the package…' }).click()
    await expect(dlg.getByRole('status')).toContainText('Saved')
    await dlg.getByRole('button', { name: 'Close' }).click()
    await win.getByRole('button', { name: 'New ▾' }).click()
    await win.getByRole('menuitem', { name: 'Blank project' }).click()
    await stubOpenDialog(app, pkg)
    await win.getByRole('button', { name: 'Share ▾' }).click()
    await win.getByRole('menuitem', { name: 'Open a shared project…' }).click()
    await expect(win.getByRole('status').filter({ hasText: 'Try it in oak' })).toBeVisible()
    await expect(win.getByText('PARTS (8)')).toBeVisible()
  } finally {
    kill(app)
  }
})
