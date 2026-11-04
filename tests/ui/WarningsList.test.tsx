// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { WarningsList } from '../../src/ui/designer/WarningsList'

const mocks = vi.hoisted(() => ({ select: vi.fn(), openLibrary: vi.fn(), kidMessage: vi.fn(() => 'Kid-friendly warning') }))
type Warning = { kind: string; message: string; boardIds: string[]; link?: { page: 'movement'; width: number; speciesId: string } }
const state = vi.hoisted(() => ({ warnings: [] as Warning[], kidsMode: false, project: { boards: [{ id: 'a', name: 'Left side' }, { id: 'b', name: 'Shelf' }] } }))
vi.mock('../../src/ui/store', () => ({ useStudio: (selector: (s: typeof state) => unknown) => selector(state), studio: { getState: () => ({ select: mocks.select }) } }))
vi.mock('../../src/library/ui/Library', () => ({ openLibrary: mocks.openLibrary }))
vi.mock('../../src/kids/kidWords', () => ({ kidMessage: mocks.kidMessage }))

describe('WarningsList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.kidsMode = false
    state.warnings = [{ kind: 'collision', message: 'Parts overlap', boardIds: ['a', 'b'] }]
  })
  afterEach(cleanup)

  it('renders nothing when no warnings exist', () => {
    state.warnings = []
    const { container } = render(<WarningsList />)
    expect(container.childElementCount).toBe(0)
  })

  it('shows affected names and selects their IDs', () => {
    render(<WarningsList />)
    expect(screen.getByText('Parts: Left side, Shelf')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Parts overlap. Select affected parts: Left side, Shelf' }))
    expect(mocks.select).toHaveBeenCalledWith(['a', 'b'])
  })

  it('explains the structural-safety limitation in adult mode', () => {
    render(<WarningsList />)
    expect(screen.getByRole('heading', { name: 'Project checks (1)' })).toBeTruthy()
    expect(screen.getByText(/do not certify structural safety/)).toBeTruthy()
  })

  it('keeps children’s messages and filters advice warnings', () => {
    state.kidsMode = true
    state.warnings.push({ kind: 'sag', message: 'Sag advice', boardIds: ['b'] }, { kind: 'crossGrain', message: 'Movement advice', boardIds: ['a'] })
    render(<WarningsList />)
    expect(screen.getByRole('heading', { name: 'Warnings (1)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Kid-friendly warning' })).toBeTruthy()
    expect(screen.queryByText(/Parts:/)).toBeNull()
    expect(screen.queryByText(/do not certify structural safety/)).toBeNull()
    expect(mocks.kidMessage).toHaveBeenCalledWith(state.warnings[0], state.project)
  })

  it('preserves the wood-movement calculator arguments', () => {
    state.warnings = [{ kind: 'crossGrain', message: 'Movement advice', boardIds: ['a'], link: { page: 'movement', width: 12, speciesId: 'oak' } }]
    render(<WarningsList />)
    fireEvent.click(screen.getByRole('button', { name: 'Wood movement →' }))
    expect(mocks.openLibrary).toHaveBeenCalledWith('master', 'movement', { width: 12, speciesId: 'oak' })
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('handles warnings whose referenced boards no longer exist', () => {
    state.warnings = [{ kind: 'collision', message: 'Review missing part', boardIds: ['missing'] }]
    render(<WarningsList />)
    fireEvent.click(screen.getByRole('button', { name: 'Review missing part. Select affected parts' }))
    expect(mocks.select).toHaveBeenCalledWith(['missing'])
    expect(screen.queryByText(/Parts:/)).toBeNull()
  })
})
