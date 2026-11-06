import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  state: { pendingReplace: false, recovery: null as unknown, screen: 'master', userWoods: [], openDesignText: vi.fn(), setError: vi.fn() },
  saveDrawing: vi.fn(() => true),
  newDrawing: vi.fn(async () => {})
}))
vi.mock('../src/ui/store', () => ({ studio: { getState: () => mocks.state } }))
vi.mock('../src/sketch/ui/session', () => ({ saveDrawing: mocks.saveDrawing, newDrawing: mocks.newDrawing }))
vi.mock('../src/model/fileFormat', () => ({ serialize: vi.fn(() => 'blank-project') }))
vi.mock('../src/model/woods', () => ({ emptyProject: vi.fn(() => ({ name: 'Custom design' })) }))
import { startCustomDesign } from '../src/ui/designer/customDesign'

describe('Custom design lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.state.pendingReplace = false
    mocks.state.recovery = null
    mocks.state.screen = 'master'
    mocks.saveDrawing.mockReturnValue(true)
  })
  it('uses guarded project replacement and waits before opening the sketch', () => {
    expect(startCustomDesign()).toBe(true)
    expect(mocks.state.openDesignText).toHaveBeenCalledWith('blank-project', expect.objectContaining({ onOpened: expect.any(Function) }))
    expect(mocks.newDrawing).not.toHaveBeenCalled()
    mocks.state.openDesignText.mock.calls[0][1].onOpened()
    expect(mocks.newDrawing).toHaveBeenCalledWith('precise')
  })
  it('does not replace work while another replacement is pending', () => {
    mocks.state.pendingReplace = true
    expect(startCustomDesign()).toBe(false)
    expect(mocks.state.openDesignText).not.toHaveBeenCalled()
  })
  it('does not bypass recovery', () => {
    mocks.state.recovery = {}
    expect(startCustomDesign()).toBe(false)
    expect(mocks.state.openDesignText).not.toHaveBeenCalled()
  })
  it('flushes the current sketch before requesting replacement', () => {
    mocks.state.screen = 'draw'
    expect(startCustomDesign()).toBe(true)
    expect(mocks.saveDrawing).toHaveBeenCalledOnce()
  })
  it('keeps the current project if its sketch cannot be saved', () => {
    mocks.state.screen = 'draw'
    mocks.saveDrawing.mockReturnValue(false)
    expect(startCustomDesign()).toBe(false)
    expect(mocks.state.openDesignText).not.toHaveBeenCalled()
  })
})
