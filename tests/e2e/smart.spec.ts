import { createServer, type Server } from 'node:http'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { enterMasterShop, kill, launch, newDirs } from './helpers'

// A stand-in for the online service: answers by which helper asked.
let server: Server
let asked: string[] = []
test.beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', c => (body += c))
    req.on('end', () => {
      const r = JSON.parse(body)
      const sys: string = r.system
      asked.push(req.headers['x-api-key'] as string)
      const answer = sys.includes('identify wood') ? { guesses: [{ species: 'red oak', sure: 'likely', look: 'Big open pores in rows' }] }
        : sys.includes('photo of a piece of furniture') ? { name: 'Stool', steps: ['Cut the legs', 'Screw the top on'], parts: [
          { name: 'Top', width: 12, length: 12, thickness: 0.75, x: 0, y: 0, z: 17.25, lies: 'flat-x' },
          { name: 'Leg', width: 3.5, length: 17.25, thickness: 0.75, x: 0, y: 0, z: 0, lies: 'upright-x' },
          { name: 'Leg', width: 3.5, length: 17.25, thickness: 0.75, x: 8.5, y: 0, z: 0, lies: 'upright-x' }] }
        : { template: 'bookshelf', params: { W: 40, shelves: 2, wood: 'unobtainium' } } // a wood the app doesn't have is dropped
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ content: [{ type: 'text', text: '```json\n' + JSON.stringify(answer) + '\n```' }] }))
    })
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()))
  process.env.AA_TEST_PLAIN_KEY = '1'
  process.env.AA_AI_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
test.afterAll(() => { server.close(); delete process.env.AA_AI_URL; delete process.env.AA_TEST_PLAIN_KEY })

test('smart helpers: offline describe without a key; with a key, describe, photo → plan and wood ID', async () => {
  const { app, win } = await launch(newDirs())
  try {
    // No key: the offline matcher still starts a design.
    await enterMasterShop(win)
    await win.getByRole('button', { name: '✨ Describe what you want to make…' }).click()
    const d = win.getByRole('dialog', { name: 'Describe a project' })
    await d.getByLabel('Description').fill('a bookshelf 30 inches wide with 4 shelves')
    await expect(d).toContainText('Bookshelf')
    await expect(d.getByRole('button', { name: 'Ask the online helper' })).toHaveCount(0)
    await d.getByRole('button', { name: 'Start from it' }).click()
    await expect(win.getByText('PARTS (9)')).toBeVisible()

    // Add a key.
    await win.getByRole('button', { name: '✨ Helpers ▾' }).click()
    await win.getByRole('menuitem', { name: 'Settings…' }).click()
    const st = win.getByRole('dialog', { name: 'Smart Helpers settings' })
    await st.getByLabel('API key').fill('sk-ant-test-0123456789abcdef')
    await st.getByRole('button', { name: 'Save' }).click()
    await expect(st.getByRole('status', { name: 'Helper status' })).toContainText('A key is set')
    // Changing only the model keeps the key.
    await st.getByLabel('Model').fill('claude-sonnet-5-5-test')
    await st.getByRole('button', { name: 'Save' }).click()
    await expect(st.getByText('Saved.', { exact: false })).toBeVisible()
    await expect(st.getByRole('status', { name: 'Helper status' })).toContainText('A key is set')
    await st.getByLabel('Model').fill('claude-sonnet-5-5')
    await st.getByRole('button', { name: 'Save' }).click()
    await st.getByRole('button', { name: 'Close' }).click()

    // Describe online → template.
    await win.getByRole('button', { name: '✨ Helpers ▾' }).click()
    await win.getByRole('menuitem', { name: 'Describe a project…' }).click()
    await d.getByLabel('Description').fill('something to hold my books')
    await d.getByRole('button', { name: 'Ask the online helper' }).click()
    // The design from the first description isn't saved: the app asks first.
    const discard = win.getByRole('dialog', { name: 'Unsaved changes' }).getByRole('button', { name: "Don't Save" })
    await discard.click()
    await expect(win.getByText('PARTS (7)')).toBeVisible()

    // Photo → plan.
    await win.getByRole('button', { name: '✨ Helpers ▾' }).click()
    await win.getByRole('menuitem', { name: 'Photo → plan…' }).click()
    const pp = win.getByRole('dialog', { name: 'Photo → plan' })
    await pp.getByLabel('Photo').setInputFiles(join(process.cwd(), 'tests/plans/fixtures/photo-page.jpg'))
    await expect(pp.getByAltText('Chosen photo')).toBeVisible()
    await pp.getByLabel('Known size').fill('18')
    await pp.getByRole('button', { name: 'Make a plan' }).click()
    await discard.click()
    await expect(win.getByText('PARTS (3)')).toBeVisible()
    await expect(win.getByRole('complementary', { name: 'Helper build steps' })).toContainText('Screw the top on')

    // What wood is this?
    await win.getByRole('button', { name: '✨ Helpers ▾' }).click()
    await win.getByRole('menuitem', { name: 'What wood is this?…' }).click()
    const w = win.getByRole('dialog', { name: 'What wood is this?' })
    await w.getByLabel('Photo').setInputFiles(join(process.cwd(), 'tests/plans/fixtures/photo-page.jpg'))
    await w.getByRole('button', { name: 'What wood is it?' }).click()
    await expect(w.getByRole('list', { name: 'Wood guesses' })).toContainText('Red oak')
    expect(asked.every(k => k === 'sk-ant-test-0123456789abcdef')).toBe(true)
  } finally {
    kill(app)
  }
})

test('without a key, "trace it instead" puts the chosen photo in Pictures with the steps to scale it', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await enterMasterShop(win)
    await win.getByRole('button', { name: '✨ Helpers ▾' }).click()
    await win.getByRole('menuitem', { name: 'Photo → plan…' }).click()
    const pp = win.getByRole('dialog', { name: 'Photo → plan' })
    await pp.getByLabel('Photo').setInputFiles(join(process.cwd(), 'tests/plans/fixtures/photo-page.jpg'))
    await expect(pp.getByAltText('Chosen photo')).toBeVisible()
    await pp.getByLabel('Known size').fill('30')
    await pp.getByRole('button', { name: 'trace it instead' }).click()
    await expect(win.getByRole('region', { name: 'Pictures' }).getByRole('listitem', { name: 'Picture Photo to trace' })).toBeVisible()
    const steps = win.getByRole('complementary', { name: 'Helper build steps' })
    await expect(steps).toContainText('Trace your photo')
    await expect(steps).toContainText('type 30"')
  } finally {
    kill(app)
  }
})
