import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { join } from 'node:path'
import { enterMasterShop, kill, launch, newDirs } from './helpers'

const FX = join(process.cwd(), 'tests/plans/fixtures')

async function stubPicker(app: ElectronApplication, paths: string[]) {
  await app.evaluate(({ dialog }, ps) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: ps })) as typeof dialog.showOpenDialog
  }, paths)
}

async function stubPrint(app: ElectronApplication) {
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    ;(globalThis as any).__printed = []
    w.webContents.print = ((opts: unknown, cb: (ok: boolean) => void) => {
      ;(globalThis as any).__printed.push(opts)
      cb(true)
    }) as typeof w.webContents.print
  })
}

async function openPlans(win: Page) {
  await enterMasterShop(win)
  await win.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('link', { name: 'My Plans', exact: true }).click()
  await expect(win.getByRole('heading', { name: 'My Plans' })).toBeVisible()
}

async function bringIn(win: Page, kind: 'PDF…' | 'Photos or scans…') {
  await win.getByRole('button', { name: 'Bring in a plan ▾' }).click()
  await win.getByRole('button', { name: kind }).click()
  await expect(win.getByRole('heading', { name: 'Check the brought-in plan' })).toBeVisible({ timeout: 60_000 })
}

test('plans 1. write a plan with steps and a typed cut list, then print its guide (portrait)', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await stubPrint(app)
    await openPlans(win)
    await win.getByRole('button', { name: 'New plan' }).click()
    await win.getByLabel('Plan name').fill('Garden bench')
    await win.getByRole('tab', { name: 'Steps' }).click()
    for (const [i, t] of ['Cut the legs.', 'Drill pilot holes.', 'Screw on the seat.'].entries()) {
      await win.getByRole('button', { name: 'Add step' }).click()
      await win.getByLabel(`Step ${i + 1} text`).fill(t)
    }
    await win.getByRole('tab', { name: 'Cut list' }).click()
    await win.getByRole('button', { name: 'Add row' }).click()
    await win.getByRole('button', { name: 'Add row' }).click()
    await win.getByLabel('Row 2 length').fill('48')
    await win.getByLabel('Row 2 length').press('Enter')
    await win.getByRole('button', { name: 'Print build guide' }).click()
    const guide = win.getByRole('article', { name: 'Build guide' })
    await expect(guide.getByRole('heading', { name: 'Garden bench' })).toBeVisible()
    await expect(guide.getByRole('checkbox')).toHaveCount(3)
    await expect(guide.getByRole('table', { name: 'Cut list' }).locator('tbody tr')).toHaveCount(2)
    await win.getByRole('button', { name: '🖨 Print build guide' }).click()
    await expect.poll(() => app.evaluate(() => (globalThis as any).__printed)).toEqual([{ landscape: false }])
    // It was saved: back out and it is in the library.
    await win.getByRole('button', { name: '← Back' }).click()
    await win.getByRole('button', { name: '← My Plans' }).click()
    await expect(win.getByRole('button', { name: 'Garden bench' })).toBeVisible()
  } finally {
    kill(app)
  }
})

test('plans 2. bring in a PDF: the drafted cut list is right; Accept all; it reopens', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await openPlans(win)
    await stubPicker(app, [join(FX, 'stool.pdf')])
    await bringIn(win, 'PDF…')
    const draft = win.getByRole('region', { name: 'Drafted plan' })
    await expect(win.getByLabel('Plan name')).toHaveValue('Simple Step Stool')
    for (const row of ['2 × Sides — 3/4" × 11-1/4" × 9"', '1 × Top — 3/4" × 11-1/4" × 16"', '2 × Aprons — 3/4" × 3-1/2" × 14-1/2" (1x4)']) {
      await expect(draft.getByText(row, { exact: false })).toBeVisible()
    }
    await expect(draft.getByRole('textbox', { name: /Drafted step/ })).toHaveCount(5)
    await expect(win.getByRole('img', { name: 'Page 1' })).toBeVisible()
    await draft.getByRole('button', { name: 'Show Sides on the page' }).click()
    await expect(win.getByTestId('source-box')).toBeVisible()
    await win.getByRole('button', { name: 'Accept all' }).click()
    await expect(draft.getByText('check me')).toHaveCount(0)
    await win.getByRole('button', { name: 'Done — open the plan' }).click()
    await win.getByRole('button', { name: '← My Plans' }).click()
    await win.getByRole('button', { name: 'Simple Step Stool' }).click()
    await win.getByRole('tab', { name: 'Cut list' }).click()
    await expect(win.getByLabel('Row 1 part')).toHaveValue('Sides')
  } finally {
    kill(app)
  }
})

test('plans 3. bring in a phone photo: steps are read and marked check me', async () => {
  test.setTimeout(120_000)
  const { app, win } = await launch(newDirs())
  try {
    await openPlans(win)
    await stubPicker(app, [join(FX, 'photo-page.jpg')])
    await bringIn(win, 'Photos or scans…')
    const draft = win.getByRole('region', { name: 'Drafted plan' })
    await expect(draft.getByRole('textbox', { name: /Drafted step/ })).toHaveCount(5)
    expect(await draft.getByText('check me').count()).toBeGreaterThanOrEqual(9)
    await expect(draft.getByLabel('Drafted step 1')).toHaveValue(/Cut all parts to length/)
  } finally {
    kill(app)
  }
})

test("plans 4. a kid-friendly plan shows on the kids' side with grown-up steps marked; an adult plan doesn't", async () => {
  const { app, win } = await launch(newDirs())
  try {
    await openPlans(win)
    for (const [name, kid] of [['Kid shelf', true], ['Big table', false]] as const) {
      await win.getByRole('button', { name: 'New plan' }).click()
      await win.getByLabel('Plan name').fill(name)
      if (kid) await win.getByLabel(/Kid-friendly/).check()
      await win.getByRole('tab', { name: 'Steps' }).click()
      await win.getByRole('button', { name: 'Add step' }).click()
      await win.getByLabel('Step 1 text').fill('Drill the holes.')
      await win.getByLabel('Step 1 tool').selectOption('drill')
      await win.getByRole('button', { name: '← My Plans' }).click()
    }
    await win.getByRole('button', { name: '← Back' }).click()
    await win.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('link', { name: 'Dashboard', exact: true }).click()
    await win.getByRole('button', { name: /Kids' Workshop/ }).click()
    // Set the tool level to Beginner (the drill is an Intermediate tool).
    await win.getByRole('button', { name: 'Parent' }).click()
    await win.getByLabel("Child's first name").fill('Sam')
    await win.getByLabel('New PIN').fill('1234')
    await win.getByLabel('PIN again').fill('1234')
    await win.getByRole('button', { name: 'Save PIN' }).click()
    await win.getByRole('radio', { name: 'Beginner' }).click()
    await expect(win.getByRole('radio', { name: 'Beginner' })).toBeChecked()
    await win.getByRole('button', { name: '← Back' }).click()
    await win.getByRole('button', { name: 'My Plans' }).click()
    await expect(win.getByRole('button', { name: 'Kid shelf' })).toBeVisible()
    await expect(win.getByRole('button', { name: 'Big table' })).toHaveCount(0)
    await expect(win.getByRole('button', { name: 'New plan' })).toHaveCount(0)
    await win.getByRole('button', { name: 'Kid shelf' }).click()
    const step = win.getByRole('article', { name: 'Build guide' }).getByRole('listitem').filter({ hasText: 'Drill the holes.' })
    await expect(step.getByText('(Adult does this)')).toBeVisible()
  } finally {
    kill(app)
  }
})

test('plans 5. a black-and-white office-scanner PDF (CCITT G4) is read, and an iPhone HEIC photo too', async () => {
  test.setTimeout(150_000)
  const { app, win } = await launch(newDirs())
  try {
    await openPlans(win)
    await stubPicker(app, [join(FX, 'scan-g4.pdf')])
    await bringIn(win, 'PDF…')
    const draft = win.getByRole('region', { name: 'Drafted plan' })
    await expect(draft.getByRole('textbox', { name: /Drafted step/ })).toHaveCount(3)
    await expect(draft.getByText('4 × Legs', { exact: false })).toBeVisible()
    await win.getByRole('button', { name: '← My Plans' }).click()
    await stubPicker(app, [join(FX, 'photo-page.heic')])
    await bringIn(win, 'Photos or scans…')
    await expect(win.getByRole('region', { name: 'Drafted plan' }).getByRole('textbox', { name: /Drafted step/ })).toHaveCount(5)
  } finally {
    kill(app)
  }
})
