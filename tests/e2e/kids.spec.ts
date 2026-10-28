import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { kill, launch, newDirs, part, typeInches } from './helpers'

type Q = { prompt: string; choices: string[]; correct: number }
const quiz1: { questions: Q[] } = JSON.parse(readFileSync(join(process.cwd(), 'src/kids/content/quizzes/quiz-1.json'), 'utf8'))

async function openKids(win: Page) {
  await win.getByRole('button', { name: /Kids' Workshop/ }).click()
  await expect(win.getByRole('button', { name: 'My Path' })).toBeVisible()
}

async function setUpParent(win: Page) {
  await win.getByRole('button', { name: 'Parent' }).click()
  await win.getByLabel("Child's first name").fill('Sam')
  await win.getByLabel('New PIN').fill('1234')
  await win.getByLabel('PIN again').fill('1234')
  await win.getByRole('button', { name: 'Save PIN' }).click()
  await expect(win.getByRole('radiogroup', { name: 'Tool level' })).toBeVisible()
  await win.getByRole('button', { name: '← Back' }).click()
}

async function passLevel1(win: Page) {
  await win.getByRole('button', { name: 'My Path' }).click()
  await win.getByRole('button', { name: /Take the Level 1 quiz/ }).click()
  for (let i = 0; i < quiz1.questions.length; i++) {
    const prompt = (await win.getByTestId('quiz-prompt').innerText()).trim()
    const q = quiz1.questions.find(x => x.prompt === prompt)!
    await win.getByRole('button', { name: q.choices[q.correct], exact: true }).click()
    await win.getByRole('button', { name: i === quiz1.questions.length - 1 ? 'See my score' : 'Next question' }).click()
  }
  await expect(win.getByText('You passed!')).toBeVisible()
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

test('kids 1. parent setup, pass the Level 1 quiz: projects unlock and Level 2 opens', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await openKids(win)
    await setUpParent(win)
    await expect(win.getByText('Hi, Sam!', { exact: false })).toBeVisible()
    await passLevel1(win)
    await win.getByRole('button', { name: 'See the projects →' }).click()
    await win.getByRole('button', { name: /Pencil holder/ }).click()
    await expect(win.getByRole('button', { name: 'Print project sheet' })).toBeEnabled()
    await win.getByRole('button', { name: '← Back' }).click()
    await win.getByRole('button', { name: '← Back' }).click()
    await win.getByRole('button', { name: 'My Path' }).click()
    await expect(win.getByRole('region', { name: 'Level 2: Builder' }).getByText(/Locked/)).toHaveCount(0)
  } finally {
    kill(app)
  }
})

test('kids 2. the pencil holder sheet prints portrait with its cut sheet and photo box', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await stubPrint(app)
    await openKids(win)
    await passLevel1(win)
    await win.getByRole('button', { name: 'See the projects →' }).click()
    await win.getByRole('button', { name: /Pencil holder/ }).click()
    await win.getByRole('button', { name: 'Print project sheet' }).click()
    const sheet = win.getByRole('article', { name: 'Project sheet' })
    await expect(sheet.getByRole('table', { name: 'Cut sheet' }).locator('tbody tr')).toHaveCount(3)
    await expect(sheet.getByText('Glue your photo here')).toBeVisible()
    await win.getByRole('button', { name: '🖨 Print' }).click()
    await expect.poll(() => app.evaluate(() => (globalThis as any).__printed)).toEqual([{ landscape: false }])
  } finally {
    kill(app)
  }
})

test('kids 3. Mark as built needs the right PIN; then the badge and certificate appear', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await openKids(win)
    await setUpParent(win)
    await passLevel1(win)
    await win.getByRole('button', { name: 'See the projects →' }).click()
    await win.getByRole('button', { name: /Pencil holder/ }).click()
    await win.getByRole('button', { name: 'Mark as built' }).click()
    const ask = win.getByRole('dialog', { name: 'Parent PIN' })
    await ask.getByLabel('PIN').fill('9999')
    await ask.getByRole('button', { name: 'OK' }).click()
    await expect(ask.getByText("That PIN isn't right.")).toBeVisible()
    await ask.getByLabel('PIN').fill('1234')
    await ask.getByRole('button', { name: 'OK' }).click()
    await expect(win.getByText(/badge earned/)).toBeVisible()
    await win.getByRole('button', { name: '← Back' }).click()
    await win.getByRole('button', { name: '← Back' }).click()
    await win.getByRole('button', { name: 'My Badges' }).click()
    await expect(win.getByRole('heading', { name: 'Pencil holder' })).toBeVisible()
    await win.getByRole('listitem').filter({ hasText: 'Pencil holder' }).getByRole('button', { name: 'Print certificate' }).click()
    const cert = win.getByRole('article', { name: 'Certificate' })
    await expect(cert.getByText('Sam')).toBeVisible()
    await expect(cert.getByText('Pencil holder')).toBeVisible()
  } finally {
    kill(app)
  }
})

test('kids 4. Simple Designer: sizes go to 1/8", the cut list matches, and Home returns to the workshop', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await openKids(win)
    await win.getByRole('button', { name: 'Simple Designer' }).click()
    await expect(win.getByText('Design your own project!')).toBeVisible()
    await win.getByRole('button', { name: 'Add board' }).click()
    await win.getByRole('button', { name: 'Add board' }).click()
    await win.getByRole('list', { name: 'Parts' }).getByRole('listitem').nth(0).click()
    await typeInches(win, 'Length', '12')
    await win.getByRole('list', { name: 'Parts' }).getByRole('listitem').nth(1).click()
    await typeInches(win, 'Length', '10.1')
    await expect(win.getByLabel('Length', { exact: true })).toHaveValue('10-1/8"')
    await expect(win.getByRole('button', { name: 'Mirror ▾' })).toHaveCount(0)
    await win.getByRole('button', { name: 'Cut List' }).click()
    const rows = win.getByRole('dialog', { name: 'Cut list' }).locator('tbody tr')
    await expect(rows).toHaveCount(2)
    await expect(rows.filter({ hasText: '10-1/8"' })).toHaveCount(1)
    await expect(rows.filter({ hasText: '12"' })).toHaveCount(1)
    await win.getByRole('button', { name: 'Close' }).click()
    await expect(part(win, 'Board 1')).toBeVisible()
    await win.getByRole('button', { name: /Kids' Workshop/ }).click()
    await expect(win.getByRole('button', { name: 'My Path' })).toBeVisible()
  } finally {
    kill(app)
  }
})

test('kids 5. a certificate prints on exactly one landscape page', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await openKids(win)
    await passLevel1(win)
    await win.getByRole('button', { name: '← Back' }).first().click()
    await win.getByRole('button', { name: '← Back' }).first().click()
    await win.getByRole('button', { name: 'My Badges' }).click()
    await win.getByRole('button', { name: 'Print certificate' }).click()
    await expect(win.getByRole('article', { name: 'Certificate' })).toBeVisible()
    const pages = await app.evaluate(async ({ BrowserWindow }) => {
      const pdf = await BrowserWindow.getAllWindows()[0].webContents.printToPDF({ landscape: true, pageSize: 'Letter', preferCSSPageSize: true })
      return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
    })
    expect(pages).toBe(1)
  } finally {
    kill(app)
  }
})
