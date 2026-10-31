import { expect, test, type Page } from '@playwright/test'
import { kill, launch, newDirs } from './helpers'

const SHOTS = process.env.AA_SHOTS
const shot = async (win: Page, name: string) => { if (SHOTS) await win.screenshot({ path: `${SHOTS}/${name}.png` }) }

test('kids games: a tape round, a hazard found, a joint puzzle solved, a turning scored, a wood matched', async () => {
  const { app, win } = await launch(newDirs())
  try {
    await win.getByRole('button', { name: /Kids' Workshop/ }).click()
    await win.getByRole('button', { name: 'Games' }).click()

    // Read the Tape: answer every question (some right, some wrong) until the round ends.
    await win.getByRole('button', { name: /Read the Tape/ }).click()
    await shot(win, 'games-tape')
    for (let k = 0; k < 10; k++) {
      await win.getByRole('group', { name: 'Choices' }).getByRole('button').first().click()
      await expect(win.getByRole('alert')).toBeVisible()
      await win.getByRole('button', { name: 'Next →' }).click()
    }
    await expect(win.getByRole('status', { name: 'Round done' })).toContainText('of 10 right')
    // Find it mode: tap the tape.
    await win.getByRole('button', { name: 'Find it' }).click()
    await win.getByRole('img', { name: 'Tape measure' }).click({ position: { x: 300, y: 40 } })
    await expect(win.getByRole('alert')).toBeVisible()
    await win.getByRole('button', { name: '← Back' }).click()

    // Spot the Hazard: the cord on the floor, then a hint.
    await win.getByRole('button', { name: /Spot the Hazard/ }).click()
    const pic = win.getByRole('img', { name: 'Workshop picture' })
    const box = (await pic.boundingBox())!
    await pic.click({ position: { x: (330 / 800) * box.width, y: (455 / 500) * box.height } })
    await expect(win.getByRole('region', { name: 'Hazard' })).toContainText('Cord across the floor')
    await win.getByRole('button', { name: 'Show me one' }).click()
    await expect(win.getByRole('status', { name: 'Found' })).toHaveText('2 of 8 found')
    await shot(win, 'games-hazard')
    await win.getByRole('button', { name: '← Back' }).click()

    // Joint Puzzle: try pieces until one fits, then name it.
    await win.getByRole('button', { name: /Joint Puzzle/ }).click()
    for (let k = 1; k <= 3; k++) {
      await win.getByRole('button', { name: `Piece ${k}` }).click()
      if (await win.getByText('It fits!').isVisible()) break
      await win.getByRole('button', { name: 'Next →' }).click()
    }
    await expect(win.getByText('It fits!')).toBeVisible()
    await shot(win, 'games-joint')
    await win.getByRole('group', { name: 'Joint names' }).getByRole('button').first().click()
    await expect(win.getByRole('alert')).toBeVisible()
    await win.getByRole('button', { name: '← Back' }).click()

    // Lathe: hold the gouge on the blank for a moment; the score moves.
    await win.getByRole('button', { name: /Lathe Turning/ }).click()
    const lathe = win.getByRole('img', { name: 'Lathe' })
    const lb = (await lathe.boundingBox())!
    await win.mouse.move(lb.x + lb.width * 0.5, lb.y + lb.height * 0.2)
    await win.mouse.down()
    for (let k = 0; k < 20; k++) { await win.mouse.move(lb.x + lb.width * (0.2 + k * 0.03), lb.y + lb.height * 0.3); await win.waitForTimeout(30) }
    await win.mouse.up()
    await win.getByRole('button', { name: "I'm done" }).click()
    await expect(win.getByRole('alert')).toContainText('You matched')
    await shot(win, 'games-lathe')
    await win.getByRole('button', { name: '← Back' }).click()

    // Match the Wood.
    await win.getByRole('button', { name: /Match the Wood/ }).click()
    await expect(win.getByLabel('Clue')).toBeVisible()
    await shot(win, 'games-wood')
    await win.getByRole('group', { name: 'Choices' }).getByRole('button').first().click()
    await expect(win.getByRole('alert')).toBeVisible()
  } finally {
    kill(app)
  }
})
