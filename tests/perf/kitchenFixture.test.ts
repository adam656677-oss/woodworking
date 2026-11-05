import { mkdirSync, writeFileSync } from 'node:fs'
import { buildKitchen, kitchenText } from '../fixtures/kitchenGenerator'

test('writes the kitchen fixture when asked', () => {
  const p = buildKitchen()
  console.log('boards', p.boards.length, 'joints', p.joints.length, 'groups', p.groups?.length)
  if (process.env.AA_WRITE_FIXTURE) {
    mkdirSync('tests/fixtures', { recursive: true })
    writeFileSync('tests/fixtures/kitchen.aaw', kitchenText())
  }
})
