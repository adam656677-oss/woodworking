import { expect, test, type Page } from '@playwright/test'
import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { cutListRows, enterMasterShop, kill, launch, newDirs, part, stubOpenDialog, typeInches } from './helpers'

// A full kitchen (tests/fixtures/kitchen.aaw: 16 cabinets, ~350 parts) in the real app: it opens, the 3D view stays a
// sane size to draw, and changing one dimension updates the cut list in good time. Budgets are generous because CI
// draws the 3D view in software; they catch a return of seconds-long freezes, not a slow frame.
const FIXTURE = join(process.cwd(), 'tests/fixtures/kitchen.aaw')
const frames = (win: Page, n: number) => win.evaluate(count => new Promise<void>(resolve => {
  const step = (left: number) => requestAnimationFrame(() => (left <= 1 ? resolve() : step(left - 1)))
  step(count)
}), n)

/** GL draw calls and triangles sent for one drawn frame (counted from the page's own GL calls). */
async function oneFrame(win: Page) {
  return win.evaluate(() => new Promise<{ calls: number; triangles: number }>(resolve => {
    const total = { calls: 0, triangles: 0, frames: 0 }
    const saved: [any, string, any][] = []
    const wrap = (proto: any, name: string, on: (a: number[], t: typeof total) => void) => {
      const orig = proto[name]
      if (!orig) return
      saved.push([proto, name, orig])
      proto[name] = function (...a: number[]) { on(a, total); return orig.apply(this, a) }
    }
    for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype] as any[]) {
      // GL draw modes: 4 = TRIANGLES.
      wrap(proto, 'drawElements', (a, t) => { t.calls++; if (a[0] === 4) t.triangles += a[1] / 3 })
      wrap(proto, 'drawArrays', (a, t) => { t.calls++; if (a[0] === 4) t.triangles += a[2] / 3 })
      wrap(proto, 'drawElementsInstanced', (a, t) => { t.calls++; if (a[0] === 4) t.triangles += (a[1] / 3) * a[4] })
      // The renderer clears once per frame.
      wrap(proto, 'clear', (_a, t) => { t.frames++ })
    }
    // Until a frame has actually been drawn (the first can be slow on a software GL), then one more.
    let waited = 0
    const tick = () => requestAnimationFrame(() => {
      if (total.frames === 0 && ++waited < 300) return tick()
      for (const [proto, name, orig] of saved) proto[name] = orig
      const n = Math.max(1, total.frames)
      resolve({ calls: Math.round(total.calls / n), triangles: Math.round(total.triangles / n) })
    })
    tick()
  }))
}

/** Milliseconds from the Enter key until the page's JavaScript is idle again, and until two frames have been drawn. */
async function armEditTimer(win: Page) {
  await win.evaluate(() => {
    const w = window as any
    w.__editJs = undefined
    w.__editFrame = undefined
    window.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return
      const t0 = performance.now()
      setTimeout(() => { w.__editJs = performance.now() - t0 }, 0)
      requestAnimationFrame(() => requestAnimationFrame(() => { w.__editFrame = performance.now() - t0 }))
    }, { capture: true, once: true })
  })
}

test('a full kitchen opens, edits one dimension and the cut list follows, quickly enough', async () => {
  test.setTimeout(300_000)
  const dirs = newDirs()
  const file = join(dirs.docs, 'kitchen.aaw')
  copyFileSync(FIXTURE, file)
  const { app, win } = await launch(dirs)
  try {
    await enterMasterShop(win)
    await stubOpenDialog(app, file)
    const t0 = Date.now()
    await win.getByRole('button', { name: 'Open', exact: true }).click()
    await expect(win).toHaveTitle('A&A Woodworking Studio — kitchen', { timeout: 60_000 })
    await frames(win, 2)
    const openMs = Date.now() - t0
    const draw = await oneFrame(win)
    console.log(`PERF open to first frames ${openMs} ms; one frame draws ${draw.calls} calls, ${draw.triangles} triangles`)
    expect(openMs, 'open to first frames').toBeLessThan(30_000)
    // About two per part (a mesh and its outline); the sanity limits only catch a lot more than that.
    expect(draw.calls, 'draw calls per frame').toBeGreaterThan(300)
    expect(draw.calls, 'draw calls per frame').toBeLessThan(2500)
    expect(draw.triangles, 'triangles per frame').toBeLessThan(250_000)

    const before = await cutListRows(win)
    expect(before.some(r => r[1].includes('Side') && r[4] === '30-1/2"')).toBe(true)

    // Change one dimension of the first cabinet side, as typing in the Properties panel does.
    await part(win, 'Side').click()
    // The move arrows draw (and, on a software GL, compile their shader) before the timed edit starts.
    await frames(win, 3)
    await armEditTimer(win)
    await typeInches(win, 'Length', '30')
    await expect.poll(() => win.evaluate(() => (window as any).__editFrame), { timeout: 60_000 }).toBeGreaterThan(0)
    const js = await win.evaluate(() => (window as any).__editJs as number)
    const frame = await win.evaluate(() => (window as any).__editFrame as number)
    console.log(`PERF edit: Enter to JS idle ${Math.round(js)} ms, to the second frame ${Math.round(frame)} ms`)
    expect(js, 'Enter to the page being responsive again').toBeLessThan(5_000)

    const c0 = Date.now()
    const after = await cutListRows(win)
    console.log(`PERF cut list opened in ${Date.now() - c0} ms (${after.length} rows)`)
    expect(after.some(r => r[1].includes('Side') && r[4] === '30"')).toBe(true)
    // Only that one side changed: the 30-1/2" sides are still listed, one fewer of them.
    const qty = (rows: string[][]) => Number(rows.find(r => r[1].includes('Side') && r[4] === '30-1/2"')?.[0] ?? 0)
    expect(qty(after)).toBe(qty(before) - 1)
  } finally {
    kill(app)
  }
})
