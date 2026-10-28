import { test, expect, _electron as electron } from '@playwright/test'

test('app window opens with the product name', async () => {
  const app = await electron.launch({ args: ['.', '--no-sandbox'] })
  const win = await app.firstWindow()
  await expect(win.getByRole('heading', { name: 'A&A Woodworking Studio' })).toBeVisible()
  await app.close()
})
