// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { addBoard } from '../../src/model/ops'
import { worldBox } from '../../src/model/geometry'
import { groupBoardIds, groupBoards } from '../../src/assemblies/ops'
import { GroupPanel } from '../../src/assemblies/ui/GroupPanel'
import { PartsList } from '../../src/ui/designer/PartsList'
import { Toolbar } from '../../src/ui/designer/Toolbar'
import { studio } from '../../src/ui/store'

afterEach(cleanup)
beforeEach(() => { (window as any).aa = { setDirty: () => {} } })

function start() {
  studio.setState({ dirty: false, kidsMode: false })
  const s = studio.getState()
  s.newBlank()
  const ids: string[] = []
  for (const [name, x] of [['Front', 0], ['Back', 10], ['Shelf', 20]] as const) {
    s.apply(p => { const r = addBoard(p, { woodId: '1x6', name, width: 5.5, length: 12, position: { x, y: 0, z: 0 } }); ids.push(r.id); return r.project })
  }
  return ids
}
const groupNow = (ids: string[], name: string) => {
  let gid = ''
  act(() => studio.getState().apply(p => { const r = groupBoards(p, ids, name); if ('error' in r) return r; gid = r.id; return r.project }))
  return gid
}

test('the toolbar groups the selection under a name; Ungroup takes it apart', () => {
  const [a, b] = start()
  render(<><Toolbar /><PartsList /></>)
  act(() => studio.getState().select([a, b]))
  fireEvent.click(screen.getByRole('button', { name: 'Group' }))
  const dialog = screen.getByRole('dialog', { name: 'Name the group' })
  fireEvent.change(within(dialog).getByLabelText('Group name'), { target: { value: 'Drawer' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Group' }))
  const g = studio.getState().project.groups!
  expect(g.map(x => x.name)).toEqual(['Drawer'])
  expect(studio.getState().selection.sort()).toEqual([a, b].sort())
  expect(screen.getByRole('list', { name: 'Parts in Drawer' }).textContent).toContain('Front')
  fireEvent.click(screen.getByRole('button', { name: 'Ungroup' }))
  expect(studio.getState().project.groups).toBeUndefined()
})

test('the parts list is a tree: a group row selects its parts, closes, renames and hides', () => {
  const [a, b, c] = start()
  const gid = groupNow([a, b], 'Drawer')
  render(<PartsList />)
  const row = screen.getByRole('button', { name: 'Group Drawer' })
  fireEvent.click(row)
  expect(studio.getState().selection.sort()).toEqual([a, b].sort())
  fireEvent.click(screen.getByRole('button', { name: 'Close Drawer' }))
  expect(screen.queryByRole('list', { name: 'Parts in Drawer' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Open Drawer' }))
  fireEvent.doubleClick(row)
  const input = screen.getByLabelText('Group name')
  fireEvent.change(input, { target: { value: 'Top drawer' } }); fireEvent.blur(input)
  expect(studio.getState().project.groups![0].name).toBe('Top drawer')
  fireEvent.click(screen.getByRole('button', { name: 'Hide Top drawer' }))
  expect(studio.getState().hidden.sort()).toEqual(groupBoardIds(studio.getState().project, gid).sort())
  fireEvent.click(screen.getByRole('button', { name: 'Show Top drawer' }))
  expect(studio.getState().hidden).toEqual([])
  // The loose shelf is still listed at the top level.
  expect(within(screen.getByRole('list', { name: 'Parts' })).getAllByRole('listitem').some(li => li.textContent?.startsWith('Shelf'))).toBe(true)
  act(() => studio.getState().isolate([c]))
  expect(studio.getState().isolated).toEqual([c])
  act(() => studio.getState().showAll())
  expect(studio.getState().isolated).toBeNull()
})

test('the group panel moves the whole group and makes plain and linked copies', () => {
  const [a, b] = start()
  const gid = groupNow([a, b], 'Drawer')
  const group = () => studio.getState().project.groups!.find(g => g.id === gid)!
  const { rerender } = render(<GroupPanel group={group()} />)
  const x = screen.getByLabelText('Group X')
  fireEvent.change(x, { target: { value: '30' } }); fireEvent.blur(x)
  const p = studio.getState().project
  expect(worldBox(p.boards.find(bb => bb.id === a)!).min.x).toBe(30)
  expect(worldBox(p.boards.find(bb => bb.id === b)!).min.x).toBe(40)
  fireEvent.click(screen.getByRole('button', { name: 'Linked copy' }))
  expect(studio.getState().project.boards).toHaveLength(5)
  expect(studio.getState().project.groups!.filter(g => g.link)).toHaveLength(2)
  rerender(<GroupPanel group={group()} />)
  expect(screen.getByText(/Linked — 2 copies stay the same/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Unlink' }))
  expect(studio.getState().project.groups!.some(g => g.link)).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Duplicate group' }))
  expect(studio.getState().project.groups!.map(g => g.name)).toContain('Drawer (copy)')
})

test('a change to a linked copy happens in the other through the studio (one undo step)', () => {
  const [a, b] = start()
  const gid = groupNow([a, b], 'Drawer')
  render(<GroupPanel group={studio.getState().project.groups![0]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Linked copy' }))
  const twin = studio.getState().project.boards.find(x => x.name === 'Front' && x.id !== a)!.id
  act(() => studio.getState().apply(p => ({ ...p, boards: p.boards.map(x => (x.id === a ? { ...x, width: 7 } : x)) })))
  expect(studio.getState().project.boards.find(x => x.id === twin)!.width).toBe(7)
  act(() => studio.getState().undo())
  expect(studio.getState().project.boards.find(x => x.id === twin)!.width).toBe(5.5)
  expect(gid).toBeTruthy()
})

test("the kids' designer shows a flat list with no group controls", () => {
  const [a, b] = start()
  groupNow([a, b], 'Drawer')
  act(() => studio.setState({ kidsMode: true }))
  render(<><Toolbar /><PartsList /></>)
  expect(screen.queryByRole('button', { name: 'Group Drawer' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Group' })).toBeNull()
  expect(within(screen.getByRole('list', { name: 'Parts' })).getAllByRole('listitem')).toHaveLength(3)
  act(() => studio.setState({ kidsMode: false }))
})
