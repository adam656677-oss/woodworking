// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { InspectorTabs } from '../../src/ui/designer/InspectorTabs'

afterEach(cleanup)
const props = () => ({ properties: <input aria-label="Draft property" defaultValue="Leg" />, template: <p>Template content</p>, references: <p>Reference content</p>, checks: <p>Check content</p>, checksRequest: null, referencesRequest: false, onReferences: vi.fn() })

it('shows properties initially and preserves edits across tabs', () => {
  render(<InspectorTabs {...props()} />)
  fireEvent.change(screen.getByLabelText('Draft property'), { target: { value: 'Apron' } })
  fireEvent.click(screen.getByRole('tab', { name: 'Template' }))
  expect(screen.getByRole('tabpanel').textContent).toContain('Template content')
  fireEvent.click(screen.getByRole('tab', { name: 'Properties' }))
  expect((screen.getByLabelText('Draft property') as HTMLInputElement).value).toBe('Apron')
})

it('opens reference controls when requested', () => {
  const p = props()
  render(<InspectorTabs {...p} />)
  fireEvent.click(screen.getByRole('tab', { name: 'References' }))
  expect(p.onReferences).toHaveBeenCalledOnce()
  expect(screen.getByRole('tabpanel').textContent).toContain('Reference content')
})

it('follows toolbar requests for checks and references', () => {
  const p = props()
  const { rerender } = render(<InspectorTabs {...p} />)
  rerender(<InspectorTabs {...p} checksRequest="interference" />)
  expect(screen.getByRole('tab', { name: 'Checks' }).getAttribute('aria-selected')).toBe('true')
  rerender(<InspectorTabs {...p} checksRequest="interference" referencesRequest />)
  expect(screen.getByRole('tab', { name: 'References' }).getAttribute('aria-selected')).toBe('true')
})

it('supports arrow keys, Home, and End with focus movement', () => {
  render(<InspectorTabs {...props()} />)
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Properties' }), { key: 'ArrowRight' })
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Template' }))
  fireEvent.keyDown(document.activeElement!, { key: 'End' })
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Checks' }))
  fireEvent.keyDown(document.activeElement!, { key: 'Home' })
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Properties' }))
})
