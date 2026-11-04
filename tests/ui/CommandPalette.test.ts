import { describe, expect, it } from 'vitest'
import { filterCommands, type StudioCommand } from '../../src/ui/designer/CommandPalette'

const commands: StudioCommand[] = [
  { id: 'fit', label: 'Fit model to view', keywords: 'zoom camera extent', run() {} },
  { id: 'cut', label: 'Open cut list', keywords: 'stock materials shopping', run() {} },
  { id: 'undo', label: 'Undo', keywords: 'edit back', disabled: true, run() {} }
]

describe('command search', () => {
  it('returns all commands for an empty query', () => {
    expect(filterCommands(commands, '  ')).toEqual(commands)
  })
  it('matches case-insensitive labels and keywords', () => {
    expect(filterCommands(commands, 'CAMERA').map(c => c.id)).toEqual(['fit'])
    expect(filterCommands(commands, 'cut').map(c => c.id)).toEqual(['cut'])
  })
  it('requires every search term and tolerates extra spaces', () => {
    expect(filterCommands(commands, '  open   stock ').map(c => c.id)).toEqual(['cut'])
    expect(filterCommands(commands, 'open camera')).toEqual([])
  })
  it('keeps unavailable commands discoverable without changing their state', () => {
    const result = filterCommands(commands, 'undo')
    expect(result[0].disabled).toBe(true)
    expect(commands).toHaveLength(3)
  })
})
