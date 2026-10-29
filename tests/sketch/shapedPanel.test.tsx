// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { addSketch, shapeBoard } from '../../src/model/shaped'
import { emptyProject } from '../../src/model/woods'
import { PropertiesPanel } from '../../src/ui/designer/PropertiesPanel'
import { studio } from '../../src/ui/store'
import { apron } from './fixtures'

afterEach(cleanup)

test('a shaped part\'s width and length come from its drawing, so they can\'t be typed over', () => {
  const r = shapeBoard(addSketch(emptyProject('T'), apron()), null, 'k1', '1x6')
  if ('error' in r) throw new Error(r.error)
  studio.setState({ project: r.project, selection: [r.id] })
  render(<PropertiesPanel />)
  expect((screen.getByLabelText('Width') as HTMLInputElement).disabled).toBe(true)
  expect((screen.getByLabelText('Length') as HTMLInputElement).disabled).toBe(true)
  expect(screen.getByText(/its size comes from its drawing/)).toBeTruthy()
})
