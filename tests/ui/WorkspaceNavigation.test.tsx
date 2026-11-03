// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WorkspaceNavigation } from '../../src/ui/WorkspaceNavigation'

const mocks = vi.hoisted(() => ({
  state: { screen: 'master', kidsMode: false, pendingReplace: false },
  goto: vi.fn(), enter: vi.fn(), recovery: vi.fn(), save: vi.fn(), drawing: vi.fn(),
  finish: vi.fn(), tools: vi.fn(), library: vi.fn(), joints: vi.fn(), plans: vi.fn()
}))
vi.mock('../../src/ui/store', () => ({
  useStudio: (select: (s: typeof mocks.state) => unknown) => select(mocks.state),
  studio: { getState: () => ({ goto: mocks.goto, enterMasterShop: mocks.enter, checkUntitledAutosave: mocks.recovery }) }
}))
vi.mock('../../src/sketch/ui/session', () => ({ saveDrawing: mocks.save, newDrawing: mocks.drawing }))
vi.mock('../../src/finish/ui/FinishingSchool', () => ({ openFinishing: mocks.finish }))
vi.mock('../../src/tools/ui/ShopTools', () => ({ openShopTools: mocks.tools }))
vi.mock('../../src/library/ui/Library', () => ({ openLibrary: mocks.library }))
vi.mock('../../src/joinery/ui/JointDesigner', () => ({ openJointDesigner: mocks.joints }))
vi.mock('../../src/plans/plansStore', () => ({ plans: { getState: () => ({ openLibrary: mocks.plans }) } }))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.state = { screen: 'master', kidsMode: false, pendingReplace: false }
  mocks.save.mockReturnValue(true)
  mocks.recovery.mockResolvedValue(undefined)
})
afterEach(cleanup)

test('marks the current section and ignores an active-section click', () => {
  render(<WorkspaceNavigation />)
  expect(screen.getByRole('navigation', { name: 'Workspace' })).toBeTruthy()
  const design = screen.getByRole('button', { name: 'Design' })
  expect(design.getAttribute('aria-current')).toBe('page')
  fireEvent.click(design)
  expect(mocks.enter).not.toHaveBeenCalled()
})

test.each([['kids', false], ['master', true], ['draw', true]])('hides adult navigation on %s with kidsMode=%s', (where, kids) => {
  mocks.state.screen = where
  mocks.state.kidsMode = kids
  render(<WorkspaceNavigation />)
  expect(screen.queryByRole('navigation')).toBeNull()
})

test('uses the existing resource opener with its return destination', async () => {
  render(<WorkspaceNavigation />)
  fireEvent.click(screen.getByRole('button', { name: 'Finishing' }))
  await waitFor(() => expect(mocks.finish).toHaveBeenCalledWith('master'))
})

test('saves the drawing before leaving and blocks navigation if saving fails', async () => {
  mocks.state.screen = 'draw'
  mocks.save.mockReturnValue(false)
  render(<WorkspaceNavigation />)
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('before leaving'))
  expect(mocks.save).toHaveBeenCalledOnce()
  expect(mocks.goto).not.toHaveBeenCalled()
})

test('keeps a drawing before returning to the dashboard', async () => {
  mocks.state.screen = 'draw'
  render(<WorkspaceNavigation />)
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
  await waitFor(() => expect(mocks.goto).toHaveBeenCalledWith('home'))
  expect(mocks.save).toHaveBeenCalledOnce()
})

test('checks recovery before entering Design', async () => {
  mocks.state.screen = 'home'
  render(<WorkspaceNavigation />)
  fireEvent.click(screen.getByRole('button', { name: 'Design' }))
  await waitFor(() => expect(mocks.enter).toHaveBeenCalledOnce())
  expect(mocks.recovery).toHaveBeenCalledOnce()
})

test('does not enter Design when recovery lookup fails', async () => {
  mocks.state.screen = 'home'
  mocks.recovery.mockRejectedValue(new Error('unavailable'))
  render(<WorkspaceNavigation />)
  fireEvent.click(screen.getByRole('button', { name: 'Design' }))
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  expect(mocks.enter).not.toHaveBeenCalled()
})

test('blocks navigation during an unsaved-project replacement prompt', () => {
  mocks.state.pendingReplace = true
  render(<WorkspaceNavigation />)
  const dashboard = screen.getByRole('button', { name: 'Dashboard' }) as HTMLButtonElement
  expect(dashboard.disabled).toBe(true)
  fireEvent.click(dashboard)
  expect(mocks.goto).not.toHaveBeenCalled()
})
