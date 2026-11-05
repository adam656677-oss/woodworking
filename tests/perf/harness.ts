// Shared by the performance regression test and the baseline report: loads the kitchen fixture and times each job.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as THREE from 'three'
import { clearance } from '../../src/cabinet/motion'
import { interferences, localSolids } from '../../src/checks/solids'
import { createBuildPlan } from '../../src/drawings/buildPlan'
import { cutList } from '../../src/model/cutlist'
import { deserialize, serialize } from '../../src/model/fileFormat'
import { cutGeometry } from '../../src/model/joints'
import { updateBoard } from '../../src/model/ops'
import type { Project } from '../../src/model/types'
import { validate } from '../../src/model/validate'
import { layoutAll } from '../../src/optimize/layout'
import { shoppingList } from '../../src/optimize/shopping'
import { libraryAdvice } from '../../src/library/advice'
import { recalc } from '../../src/formulas/recalc'
import { createStudioStore } from '../../src/ui/store'

export const FIXTURE = resolve(__dirname, '../fixtures/kitchen.aaw')
export const fixtureText = () => readFileSync(FIXTURE, 'utf8')

/**
 * Median time (ms) of `runs` calls, after one untimed warm-up when `warm` is set. Counts this process's CPU time
 * (user + system) rather than the wall clock when `cpu` is set, which hardly moves when other jobs share the machine.
 */
export function time(fn: () => unknown, runs = 5, warm = true, cpu = process.env.AA_PERF_WALL === undefined): number {
  if (warm) fn()
  const t: number[] = []
  for (let i = 0; i < runs; i++) {
    const c0 = cpu ? process.cpuUsage() : undefined
    const s = performance.now()
    fn()
    if (c0) { const c = process.cpuUsage(c0); t.push((c.user + c.system) / 1000) } else t.push(performance.now() - s)
  }
  t.sort((a, b) => a - b)
  return t[Math.floor(t.length / 2)]
}

/** A store in the same state as after File > Open on the fixture. */
export function openedStore(text = fixtureText()) {
  ;(globalThis as { window?: unknown }).window ??= {}
  const store = createStudioStore()
  store.getState().openDesignText(text)
  return store
}

export const someBoard = (p: Project, name = 'Side') => p.boards.find(b => b.name === name)!

export type Timings = Record<string, number>

/** One edit of one dimension: the first base-cabinet side gets 1/16" longer or shorter. */
export const edit = (p: Project, i: number): Project => {
  const b = someBoard(p)
  return updateBoard(p, b.id, { length: b.length + (i % 2 ? -1 / 16 : 1 / 16) })
}

export function measureAll(runs = 5, heavyRuns = 3): Timings {
  const text = fixtureText()
  const out: Timings = {}
  const project = deserialize(text)
  out.parse = time(() => JSON.parse(text), runs)
  out.deserialize = time(() => deserialize(text), runs)
  out.open = time(() => openedStore(text), runs)
  out.recalc = time(() => recalc(project), runs)
  out.validate = time(() => validate(project), runs)
  out.libraryAdvice = time(() => libraryAdvice(project), runs)
  out.cutList = time(() => cutList(project), runs)
  out.layoutAll = time(() => layoutAll(project, []), runs)
  out.shoppingList = time(() => shoppingList(project, [], undefined), runs)
  out.cutGeometry = time(() => cutGeometry(project), runs)
  out.localSolids = time(() => localSolids(project), heavyRuns)
  out.interferences = time(() => interferences(project), heavyRuns)
  out.clearance = time(() => clearance(project), 1, false)
  out.buildPlan = time(() => {
    const r = createBuildPlan(project, { paper: 'letter', scale: 'auto', hidden: true, date: '2026-01-01' })
    if (!r.ok) throw new Error(r.issues.join(' '))
  }, 1, false)
  out.serialize = time(() => serialize(project), runs)
  // Editing, through the store as the Properties panel does.
  const store = openedStore(text)
  let k = 0
  out.apply = time(() => store.getState().apply(p => edit(p, k++)), runs)
  out.applyAndCutList = time(() => { store.getState().apply(p => edit(p, k++)); cutList(store.getState().project) }, runs)
  out.undo = time(() => { store.getState().undo(); store.getState().redo() }, runs)
  return out
}

/** Triangles in every part's finished geometry, and how many separate meshes the 3D view makes (a mesh and an outline each). */
export function sceneStats(p: Project) {
  const solids = localSolids(p)
  let triangles = 0
  for (const g of solids.values()) triangles += (g.getIndex()?.count ?? g.getAttribute('position').count) / 3
  return { triangles, parts: solids.size, drawObjects: solids.size * 2 }
}
export { THREE }
