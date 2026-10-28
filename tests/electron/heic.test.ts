import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { heicToRgba, isHeic } from '../../electron/heic'

test('an iPhone HEIC photo is recognised and decoded', async () => {
  const bytes = new Uint8Array(readFileSync(join(__dirname, '../plans/fixtures/photo-page.heic')))
  expect(isHeic(bytes)).toBe(true)
  expect(isHeic(new Uint8Array(readFileSync(join(__dirname, '../plans/fixtures/photo-page.jpg'))))).toBe(false)
  const img = await heicToRgba(bytes)
  expect([img.width, img.height]).toEqual([850, 1100])
  expect(img.data.length).toBe(850 * 1100 * 4)
}, 30_000)
