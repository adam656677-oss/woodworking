// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { addBoard } from '../../src/model/ops'
import type { Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'
import { taperBoard } from '../../src/shaping/taper'
import { stations, turnBoard } from '../../src/shaping/turning'
import { TaperSheet } from '../../src/shaping/ui/TaperSheet'
import { TurningSheet } from '../../src/shaping/ui/TurningSheet'
import { studio } from '../../src/ui/store'
import { formatInches } from '../../src/model/units'

afterEach(cleanup)

test('the turning sheet lists the stations and shows the profile full size with check squares', () => {
  const r = addBoard(emptyProject('T'), { woodId: '2x2', name: 'Leg', width: 1.5, length: 29 })
  const t = turnBoard(r.project, r.id, { style: 'vase', top: 5, bottom: 1 })
  if ('error' in t) throw new Error(t.error)
  studio.setState({ project: t.project })
  const b = t.project.boards[0]
  render(<TurningSheet board={b} onClose={() => {}} />)
  const rows = within(screen.getByRole('table', { name: 'Stations' })).getAllByRole('row').slice(1)
  const st = stations(t.project, b)
  expect(rows).toHaveLength(st.length)
  expect(rows[0].textContent).toBe(`5"${formatInches(st[0].diameter)}`)
  // A 29" leg over 7-1/2" pages with 1/2" overlap: 5 pages across, 1 down.
  expect(screen.getAllByRole('region', { name: /^Page [A-Z]\d$/ })).toHaveLength(5)
  for (const sq of screen.getAllByTestId('check-square')) expect(sq.style.width).toBe('1in')
  expect(screen.getByText(/Mark the pommel 5" from the top/)).toBeTruthy()
})

test('the taper sheet gives each face its start, amount, angle and jig opening, and the cutting order', () => {
  const r = addBoard(emptyProject('T'), { woodId: '2x2', name: 'Leg', width: 1.5, length: 29.5 })
  const p = taperBoard(r.project, r.id, { faces: ['left', 'top'], start: 6, foot: 0.875 }) as Project
  render(<TaperSheet board={p.boards[0]} onClose={() => {}} />)
  const rows = within(screen.getByRole('table', { name: 'Faces' })).getAllByRole('row').slice(1)
  expect(rows).toHaveLength(2)
  const cells = within(rows[0]).getAllByRole('cell').map(c => c.textContent)
  expect(cells).toEqual(['left side', '6"', '5/8"', '1.5°', '5/16"'])
  expect(screen.getAllByRole('listitem').some(li => /quarter turn/.test(li.textContent ?? ''))).toBe(true)
})
