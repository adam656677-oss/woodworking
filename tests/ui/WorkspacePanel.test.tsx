// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { WorkspacePanel, clampPanelWidth } from '../../src/ui/designer/WorkspacePanel'

afterEach(cleanup)

describe('WorkspacePanel', () => {
  it('clamps panel widths', () => {
    expect(clampPanelWidth(100)).toBe(200)
    expect(clampPanelWidth(288)).toBe(288)
    expect(clampPanelWidth(900)).toBe(420)
  })
  it('collapses and restores without unmounting its content', () => {
    render(<WorkspacePanel title="Parts" side="left" initialWidth={240}><input aria-label="Part name" defaultValue="Leg" /></WorkspacePanel>)
    fireEvent.change(screen.getByLabelText('Part name'), { target: { value: 'Apron' } })
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Parts' }))
    expect(screen.getByRole('button', { name: 'Expand Parts' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('separator')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Expand Parts' }))
    expect((screen.getByLabelText('Part name') as HTMLInputElement).value).toBe('Apron')
  })
  it('supports keyboard resizing and reset', () => {
    render(<WorkspacePanel title="Parts" side="left" initialWidth={240}>Parts</WorkspacePanel>)
    const separator = screen.getByRole('separator')
    fireEvent.keyDown(separator, { key: 'ArrowRight' })
    expect(separator.getAttribute('aria-valuenow')).toBe('250')
    fireEvent.keyDown(separator, { key: 'End' })
    expect(separator.getAttribute('aria-valuenow')).toBe('420')
    fireEvent.keyDown(separator, { key: 'Home' })
    expect(separator.getAttribute('aria-valuenow')).toBe('200')
    fireEvent.doubleClick(separator)
    expect(separator.getAttribute('aria-valuenow')).toBe('240')
  })
  it('reverses keyboard direction for the right panel', () => {
    render(<WorkspacePanel title="Inspector" side="right" initialWidth={288}>Properties</WorkspacePanel>)
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft', shiftKey: true })
    expect(screen.getByRole('separator').getAttribute('aria-valuenow')).toBe('328')
  })
})
