// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToolbarMenu } from '../../src/ui/common/ToolbarMenu'

afterEach(cleanup)
const example = () => render(<ToolbarMenu label="Actions">{close => <>
  <button role="menuitem" onClick={close}>First</button>
  <button role="menuitem" disabled>Unavailable</button>
  <button role="menuitem" onClick={close}>Last</button>
</>}</ToolbarMenu>)

test('arrow navigation skips disabled items and Escape restores trigger focus', () => {
  example()
  const trigger = screen.getByRole('button', { name: 'Actions ▾' })
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'First' }))
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Last' }))
  fireEvent.keyDown(document.activeElement!, { key: 'Home' })
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'First' }))
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  expect(screen.queryByRole('menu')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

test('mouse leave keeps the menu open but outside pointer input closes it', () => {
  example()
  fireEvent.click(screen.getByRole('button', { name: 'Actions ▾' }))
  fireEvent.mouseLeave(screen.getByRole('menu'))
  expect(screen.getByRole('menu')).toBeTruthy()
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('menu')).toBeNull()
})

test('ArrowUp opens at the last action and selecting it restores focus', () => {
  example()
  const trigger = screen.getByRole('button', { name: 'Actions ▾' })
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'ArrowUp' })
  const last = screen.getByRole('menuitem', { name: 'Last' })
  expect(document.activeElement).toBe(last)
  fireEvent.click(last)
  expect(screen.queryByRole('menu')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})
