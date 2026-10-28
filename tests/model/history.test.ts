import { History } from '../../src/model/history'

test('150 pushes then 100 undos all succeed', () => {
  const h = new History(0)
  for (let i = 1; i <= 150; i++) h.push(i)
  for (let i = 0; i < 100; i++) {
    expect(h.canUndo).toBe(true)
    h.undo()
  }
  expect(h.current).toBe(50)
})

test('redo after undo, cleared by a new push', () => {
  const h = new History('a')
  h.push('b')
  h.push('c')
  expect(h.undo()).toBe('b')
  expect(h.redo()).toBe('c')
  h.undo()
  h.push('d')
  expect(h.canRedo).toBe(false)
  expect(h.redo()).toBe('d')
})

test('undo at the start stays put; the cap drops the oldest', () => {
  const h = new History(0, 3)
  expect(h.undo()).toBe(0)
  for (let i = 1; i <= 5; i++) h.push(i)
  h.undo(); h.undo(); h.undo()
  expect(h.canUndo).toBe(false)
  expect(h.current).toBe(2)
})
