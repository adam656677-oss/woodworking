// @vitest-environment jsdom
import { createPlansStore, visiblePlans } from '../../src/plans/plansStore'
import { newPlan, type Plan } from '../../src/plans/types'

vi.mock('../../src/plans/pdf', () => ({
  pdfTextLines: vi.fn(async () => ({ lines: [{ text: 'Shelf', page: 1, box: [0, 0, 10, 10], size: 20 }, { text: '1. Cut it.', page: 1, box: [0, 20, 10, 10], size: 10 }], scanPages: [], pageCount: 1 })),
  renderPdfPage: async () => ({ png: new Uint8Array([1]), scale: 1 })
}))

function fakeAa(over: Record<string, unknown> = {}) {
  const calls: string[] = []
  const saved: Plan[] = []
  ;(window as any).aa = {
    plansList: async () => [],
    plansCreate: async (p: Plan) => { calls.push(`create:${p.name}`); return p.name },
    plansSave: async (_f: string, p: Plan) => { saved.push(structuredClone(p)) },
    plansLoad: async (f: string) => ({ plan: newPlan(f, 'p_x'), notice: null }),
    plansDiscard: async (f: string) => { calls.push(`discard:${f}`) },
    plansSavePage: async () => 'pages/page-001.png',
    plansPickImport: async () => [{ name: 'Shelf plan.pdf', bytes: new Uint8Array([37, 80, 68, 70]) }],
    plansReadDesign: async () => null,
    ...over
  }
  return { calls, saved }
}

const entry = (name: string, kidFriendly: boolean) => ({ folder: name, plan: { ...newPlan(name, `p_${name}`), kidFriendly } })

test('the kids see only kid-friendly plans; plans that cannot open are hidden from them too', () => {
  const list = [entry('A', true), entry('B', false), { folder: 'C', plan: null, error: "can't be opened" }]
  expect(visiblePlans(list, true).map(e => e.folder)).toEqual(['A'])
  expect(visiblePlans(list, false).map(e => e.folder)).toEqual(['A', 'B', 'C'])
})

test('New plan makes a folder called "New plan" and opens the editor', async () => {
  const { calls } = fakeAa()
  const s = createPlansStore()
  await s.getState().create()
  expect(calls).toEqual(['create:New plan'])
  expect(s.getState().view).toBe('edit')
  expect(s.getState().current?.folder).toBe('New plan')
})

test('every change is saved', async () => {
  const { saved } = fakeAa()
  const s = createPlansStore()
  await s.getState().create()
  await s.getState().update(p => ({ ...p, notes: 'Use pine' }))
  expect(saved.at(-1)!.notes).toBe('Use pine')
})

test('bringing in a PDF drafts the plan and opens the review', async () => {
  const { saved } = fakeAa()
  const s = createPlansStore()
  await s.getState().startImport('pdf')
  expect(s.getState().view).toBe('import')
  const p = s.getState().current!.plan
  expect(p.name).toBe('Shelf')
  expect(p.steps.map(x => x.text)).toEqual(['Cut it.'])
  expect(p.source).toEqual({ kind: 'pdf', name: 'Shelf plan.pdf', pages: 1 })
  expect(saved.length).toBeGreaterThan(0)
})

test('cancelling an import removes its folder and goes back to the library', async () => {
  const { calls } = fakeAa({
    plansSavePage: async () => {
      await new Promise(r => setTimeout(r, 20))
      return 'pages/page-001.png'
    }
  })
  const s = createPlansStore()
  const run = s.getState().startImport('pdf')
  await new Promise(r => setTimeout(r, 5))
  s.getState().cancelImport()
  await run
  expect(calls).toContain('discard:Shelf plan')
  expect(s.getState().view).toBe('library')
  expect(s.getState().current).toBeNull()
})

test('accepting clears "check me"; Accept all clears them all; deleting a drafted step removes it', async () => {
  fakeAa()
  const s = createPlansStore()
  await s.getState().startImport('pdf')
  const step = s.getState().current!.plan.steps[0]
  await s.getState().acceptItem(step.id)
  expect(s.getState().current!.plan.unchecked).not.toContain(step.id)
  await s.getState().deleteItem(step.id)
  expect(s.getState().current!.plan.steps).toEqual([])
  await s.getState().acceptAll()
  expect(s.getState().current!.plan.unchecked).toEqual([])
})

test('a failed import shows its plain message and leaves nothing behind', async () => {
  const { calls } = fakeAa({ plansPickImport: async () => [{ name: 'bad.pdf', bytes: new Uint8Array([1]) }] })
  const pdf = await import('../../src/plans/pdf')
  const { PlanImportError } = await import('../../src/plans/importError')
  vi.mocked(pdf.pdfTextLines).mockRejectedValueOnce(new PlanImportError('locked'))
  const s = createPlansStore()
  await s.getState().startImport('pdf')
  expect(s.getState().notice).toMatch(/locked/)
  expect(calls).toContain('discard:bad')
  expect(s.getState().view).toBe('library')
})
