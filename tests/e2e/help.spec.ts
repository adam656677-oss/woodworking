import { expect, test } from '@playwright/test'
import { kill, launch, newDirs } from './helpers'

test('help: F1 on Home, search a topic, shortcuts, and the kids help', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await expect(win.getByRole('heading', { name: 'A&A Woodworking Studio' })).toBeVisible()

    // F1 opens Master Shop help from Home.
    await win.keyboard.press('F1')
    const dialog = win.getByRole('dialog', { name: 'Help' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('data-audience', 'master')

    // Search for a topic and read its steps.
    await dialog.getByRole('searchbox', { name: 'Search help' }).fill('autosave')
    const topics = dialog.getByRole('list', { name: 'Help topics' })
    await expect(topics.getByRole('button', { name: 'How do autosave and recovery work?' })).toBeVisible()
    await topics.getByRole('button', { name: 'How do autosave and recovery work?' }).click()
    await expect(dialog.getByRole('heading', { level: 3, name: 'How do autosave and recovery work?' })).toBeVisible()
    await expect(dialog.getByRole('list', { name: 'Steps' }).getByRole('listitem').first()).toContainText('30 seconds')

    // The keyboard shortcuts list.
    await dialog.getByRole('tab', { name: 'Keyboard shortcuts' }).click()
    await expect(dialog.getByText('Ctrl+S', { exact: true }).first()).toBeVisible()
    await dialog.getByRole('searchbox', { name: 'Search help' }).fill('redo')
    await expect(dialog.getByText('Ctrl+Y', { exact: true }).first()).toBeVisible()
    await expect(dialog.getByText('Ctrl+D', { exact: true })).toHaveCount(0)

    // Esc closes it.
    await win.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    // The Help button returns focus to itself when help closes.
    const helpButton = win.getByRole('button', { name: 'Help', exact: true })
    await helpButton.click()
    await expect(win.getByRole('dialog', { name: 'Help' })).toBeVisible()
    await win.keyboard.press('Escape')
    await expect(helpButton).toBeFocused()

    // Kids' Workshop: simpler, bigger help, opened with F1 or its own button.
    await win.getByRole('button', { name: /Kids' Workshop/ }).click()
    await expect(win.getByRole('button', { name: 'My Path' })).toBeVisible()
    await win.keyboard.press('F1')
    const kids = win.getByRole('dialog', { name: 'Help' })
    await expect(kids).toHaveAttribute('data-audience', 'kids')
    await expect(kids.getByRole('searchbox')).toHaveCount(0)
    await kids.getByRole('button', { name: 'How do I print a project sheet?' }).click()
    await expect(kids.getByRole('list', { name: 'Steps' })).toContainText('Print project sheet')
    await win.keyboard.press('Escape')
    await expect(kids).toHaveCount(0)

    // A page deeper in the kids' area opens the help for that page.
    await win.getByRole('button', { name: 'Games' }).click()
    await win.getByRole('button', { name: 'Help', exact: true }).click()
    await expect(win.getByRole('dialog', { name: 'Help' }).getByRole('heading', { level: 3 })).toHaveText('How do I play the games?')
  } finally { kill(app) }
})

test('help: the Master Shop has a Help button, and F1 there opens the topic for the screen', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await win.getByRole('button', { name: /Master Shop/ }).click()
    await win.getByRole('button', { name: 'Help', exact: true }).click()
    const dialog = win.getByRole('dialog', { name: 'Help' })
    await expect(dialog).toBeVisible()
    await win.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    // Keys pressed in Help belong to Help: Delete on a focused topic must not delete the selected board underneath.
    await win.getByRole('button', { name: 'Add board' }).click()
    const parts = win.getByRole('list', { name: 'Parts' }).getByRole('listitem')
    await expect(parts).toHaveCount(1)
    await parts.first().click()
    await win.getByRole('button', { name: 'Help', exact: true }).click()
    const help = win.getByRole('dialog', { name: 'Help' })
    await help.getByRole('list', { name: 'Help topics' }).getByRole('button').first().focus()
    await win.keyboard.press('Delete')
    await win.keyboard.press('Escape')
    await expect(help).toHaveCount(0)
    await expect(parts).toHaveCount(1)

    // F1 on another screen opens the topic for that screen.
    await win.getByRole('link', { name: 'Finishing', exact: true }).click()
    await win.keyboard.press('F1')
    await expect(win.getByRole('dialog', { name: 'Help' }).getByRole('heading', { level: 3 })).toHaveText('How do I plan a finish?')
  } finally { kill(app) }
})
