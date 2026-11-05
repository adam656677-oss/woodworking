// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AppErrorBoundary } from '../../src/ui/common/AppErrorBoundary'
import { AboutBar } from '../../src/ui/common/AboutBar'
import { installErrorForwarding } from '../../src/ui/common/reportError'

const aa = { logError: vi.fn(), openLogFolder: vi.fn(async () => true), appInfo: vi.fn(async () => ({ version: '1.2.3', electron: '40.0.0', platform: 'win32', logFolder: 'C:\\Users\\x\\AppData\\Roaming\\aa\\logs' })) }
beforeEach(() => {
  vi.clearAllMocks()
  ;(window as any).aa = aa
})
afterEach(cleanup)

function Boom(): never { throw new Error('screen blew up') }

describe('AppErrorBoundary', () => {
  it('says plainly that details were saved, reports the crash, and offers the log folder', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<AppErrorBoundary><Boom /></AppErrorBoundary>)
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong on this screen.')
    expect(screen.getByText(/details about what happened were saved/i)).toBeTruthy()
    expect(aa.logError).toHaveBeenCalledWith(expect.objectContaining({ source: 'react.boundary', message: 'screen blew up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open log folder' }))
    expect(aa.openLogFolder).toHaveBeenCalled()
  })
})

describe('AboutBar', () => {
  it('shows the app version and opens the log folder', async () => {
    render(<AboutBar />)
    fireEvent.click(screen.getByRole('button', { name: 'About' }))
    const dialog = await screen.findByRole('dialog', { name: 'About' })
    await waitFor(() => expect(dialog.textContent).toContain('Version 1.2.3'))
    fireEvent.click(screen.getByRole('button', { name: 'Open log folder' }))
    expect(aa.openLogFolder).toHaveBeenCalled()
  })

  it('tells where the folder is when it cannot be opened', async () => {
    aa.openLogFolder.mockResolvedValueOnce(false)
    render(<AboutBar />)
    fireEvent.click(screen.getByRole('button', { name: 'About' }))
    await screen.findByRole('dialog', { name: 'About' })
    fireEvent.click(screen.getByRole('button', { name: 'Open log folder' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('AppData'))
  })
})

describe('installErrorForwarding', () => {
  it('sends window errors and unhandled promise rejections to the log', () => {
    const off = installErrorForwarding()
    window.dispatchEvent(new ErrorEvent('error', { message: 'bad script', error: new Error('bad script') }))
    expect(aa.logError).toHaveBeenCalledWith(expect.objectContaining({ source: 'window.onerror', message: 'bad script' }))
    const ev = new Event('unhandledrejection') as Event & { reason: unknown }
    ev.reason = new Error('nobody caught me')
    window.dispatchEvent(ev)
    expect(aa.logError).toHaveBeenCalledWith(expect.objectContaining({ source: 'unhandledrejection', message: 'nobody caught me' }))
    off()
    aa.logError.mockClear()
    window.dispatchEvent(new ErrorEvent('error', { message: 'later' }))
    expect(aa.logError).not.toHaveBeenCalled()
  })

  it('never throws when the bridge is missing or broken', () => {
    ;(window as any).aa = undefined
    const off = installErrorForwarding()
    expect(() => window.dispatchEvent(new ErrorEvent('error', { message: 'x' }))).not.toThrow()
    off()
  })
})
