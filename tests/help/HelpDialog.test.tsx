// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { closeHelp, help, openHelp } from '../../src/help/helpStore'
import { HelpButton } from '../../src/help/ui/HelpButton'
import { HelpHost } from '../../src/help/ui/HelpHost'
import { MASTER_TOPICS } from '../../src/help/topics'
import { studio } from '../../src/ui/store'

function app() {
  return render(<><HelpButton /><button>Elsewhere</button><HelpHost /></>)
}
beforeEach(() => { studio.getState().goto('home'); studio.setState({ kidsMode: false }) })
afterEach(() => { act(() => closeHelp()); cleanup() })

it('opens a labelled dialog from the Help button and puts focus inside it', () => {
  app()
  const opener = screen.getByRole('button', { name: /^Help/ })
  opener.focus()
  fireEvent.click(opener)
  const dialog = screen.getByRole('dialog', { name: 'Help' })
  expect(dialog.getAttribute('aria-modal')).toBe('true')
  expect(dialog.contains(document.activeElement)).toBe(true)
})

it('closes with Esc and gives focus back to the button that opened it', () => {
  app()
  const opener = screen.getByRole('button', { name: /^Help/ })
  opener.focus()
  fireEvent.click(opener)
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Help' }), { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(opener)
})

it('closes with the Close button and returns focus', () => {
  app()
  const opener = screen.getByRole('button', { name: /^Help/ })
  opener.focus()
  fireEvent.click(opener)
  fireEvent.click(screen.getByRole('button', { name: 'Close help' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(opener)
})

it('F1 opens the help for the screen you are on, and F1 again does not stack a second one', () => {
  app()
  fireEvent.keyDown(window, { key: 'F1' })
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  fireEvent.keyDown(window, { key: 'F1' })
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  act(() => closeHelp())
  act(() => studio.getState().goto('finish'))
  fireEvent.keyDown(window, { key: 'F1' })
  expect(within(screen.getByRole('dialog')).getByRole('heading', { level: 3 }).textContent).toBe(MASTER_TOPICS.find(t => t.id === 'finishing')!.title)
})

it('F1 opens kids help while the Kids\' Workshop is showing', () => {
  app()
  act(() => studio.getState().goto('kids'))
  fireEvent.keyDown(window, { key: 'F1' })
  expect(help.getState().audience).toBe('kids')
})

it('searches the topics as you type', () => {
  app()
  act(() => openHelp({ audience: 'master' }))
  const list = () => screen.getByRole('list', { name: 'Help topics' })
  const all = within(list()).getAllByRole('listitem').length
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search help' }), { target: { value: 'template' } })
  const some = within(list()).getAllByRole('listitem').length
  expect(some).toBeGreaterThan(0)
  expect(some).toBeLessThan(all)
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search help' }), { target: { value: 'zzzzqqq' } })
  expect(screen.getByRole('status').textContent).toMatch(/no help topics/i)
})

it('shows the numbered steps of the chosen topic', () => {
  app()
  act(() => openHelp({ audience: 'master', topicId: 'cut-list' }))
  const steps = screen.getByRole('list', { name: 'Steps' })
  expect(steps.tagName).toBe('OL')
  expect(within(steps).getAllByRole('listitem').length).toBeGreaterThanOrEqual(2)
  expect(within(steps).getAllByText('Cut List', { exact: false }).length).toBeGreaterThan(0)
})

it('lists the keyboard shortcuts, and can search them', () => {
  app()
  act(() => openHelp({ audience: 'master', view: 'shortcuts' }))
  expect(screen.getByRole('tab', { name: 'Keyboard shortcuts', selected: true })).toBeTruthy()
  expect(screen.getAllByText('Ctrl+S').length).toBeGreaterThan(0)
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search help' }), { target: { value: 'redo' } })
  expect(screen.getAllByText('Ctrl+Y').length).toBeGreaterThan(0)
  expect(screen.queryByText('Ctrl+D')).toBeNull()
})

it('switches between topics and shortcuts with the tabs', () => {
  app()
  act(() => openHelp({ audience: 'master' }))
  fireEvent.click(screen.getByRole('tab', { name: 'Keyboard shortcuts' }))
  expect(screen.getAllByText('F1').length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('tab', { name: 'How do I…' }))
  expect(screen.getByRole('list', { name: 'Help topics' })).toBeTruthy()
})

it('keeps Tab inside the dialog', () => {
  app()
  act(() => openHelp({ audience: 'master' }))
  const dialog = screen.getByRole('dialog', { name: 'Help' })
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])'))
  focusable[focusable.length - 1].focus()
  fireEvent.keyDown(dialog, { key: 'Tab' })
  expect(document.activeElement).toBe(focusable[0])
  fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(focusable[focusable.length - 1])
})

it('kids help is bigger, has no search box, and says it in simple words', () => {
  app()
  act(() => openHelp({ audience: 'kids' }))
  const dialog = screen.getByRole('dialog', { name: 'Help' })
  expect(dialog.getAttribute('data-audience')).toBe('kids')
  expect(dialog.className).toMatch(/text-(xl|2xl)/)
  expect(screen.queryByRole('searchbox')).toBeNull()
  expect(screen.queryByRole('tab', { name: 'Keyboard shortcuts' })).toBeNull()
  fireEvent.click(within(screen.getByRole('list', { name: 'Help topics' })).getAllByRole('button')[0])
  expect(screen.getByRole('list', { name: 'Steps' })).toBeTruthy()
})

it('leaves F1 alone while Shop Mode is open (Shop Mode owns the keyboard)', async () => {
  const { shop } = await import('../../src/shop/shopStore')
  app()
  shop.setState({ session: { title: 'x', steps: [], progress: { done: [], minutes: {} }, kid: false } as never })
  fireEvent.keyDown(window, { key: 'F1' })
  expect(screen.queryByRole('dialog')).toBeNull()
  shop.setState({ session: null })
  fireEvent.keyDown(window, { key: 'F1' })
  expect(screen.getByRole('dialog', { name: 'Help' })).toBeTruthy()
})

it('Esc closes Help and nothing else listening on the window sees it', () => {
  app()
  const seen: string[] = []
  const spy = (e: KeyboardEvent) => seen.push(e.key)
  window.addEventListener('keydown', spy, true)
  act(() => openHelp({ audience: 'master' }))
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Help' }), { key: 'Escape' })
  window.removeEventListener('keydown', spy, true)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(seen).toEqual([])
})

it('keys typed inside Help do not reach the design screen underneath', () => {
  app()
  act(() => openHelp({ audience: 'master' }))
  const seen: string[] = []
  const spy = (e: KeyboardEvent) => seen.push(e.key)
  window.addEventListener('keydown', spy)
  fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Search help' }), { key: 'Delete' })
  fireEvent.keyDown(within(screen.getByRole('list', { name: 'Help topics' })).getAllByRole('button')[0], { key: 'Delete' })
  window.removeEventListener('keydown', spy)
  expect(seen).toEqual([])
})
