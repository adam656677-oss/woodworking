import { deserialize, FORMAT_VERSION, migrate, ProjectFileError, serialize } from "../../src/model/fileFormat"
import { emptyProject } from '../../src/model/woods'
import { applyTemplate, TEMPLATES } from '../../src/templates'

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (e) {
    return e instanceof ProjectFileError ? e.code : 'other'
  }
  return undefined
}

test('every template default round-trips', () => {
  for (const t of TEMPLATES) {
    const p = applyTemplate(emptyProject(t.name), t.id)
    expect(deserialize(serialize(p))).toEqual(p)
  }
})

test('serialize is pretty JSON with the current formatVersion', () => {
  const text = serialize(emptyProject('X'))
  expect(text).toContain(`\n  "formatVersion": ${FORMAT_VERSION}`)
})

test('truncated JSON → corrupt', () => {
  const text = serialize(applyTemplate(emptyProject('B'), 'box'))
  expect(codeOf(() => deserialize(text.slice(0, text.length / 2)))).toBe('corrupt')
})

test('newer format → newerVersion with a plain message', () => {
  const raw = JSON.parse(serialize(emptyProject('X')))
  raw.formatVersion = FORMAT_VERSION + 1
  let msg = ''
  try { deserialize(JSON.stringify(raw)) } catch (e) { msg = (e as Error).message }
  expect(codeOf(() => deserialize(JSON.stringify(raw)))).toBe('newerVersion')
  expect(msg).toBe('This project was made with a newer version of A&A Woodworking Studio.')
})

test('a board missing width → invalid, naming the board', () => {
  const raw = JSON.parse(serialize(applyTemplate(emptyProject('B'), 'box')))
  delete raw.boards[2].width
  let err: unknown
  try { deserialize(JSON.stringify(raw)) } catch (e) { err = e }
  expect(err).toBeInstanceOf(ProjectFileError)
  expect((err as ProjectFileError).code).toBe('invalid')
  expect((err as Error).message).toContain(raw.boards[2].name)
})

test('not a project at all → invalid', () => {
  expect(codeOf(() => deserialize('{"hello": 1}'))).toBe('invalid')
  expect(codeOf(() => deserialize('[]'))).toBe('invalid')
})

test('joints pointing at missing boards → invalid', () => {
  const raw = JSON.parse(serialize(applyTemplate(emptyProject('B'), 'box')))
  raw.joints[0].hostBoardId = 'ghost'
  expect(codeOf(() => deserialize(JSON.stringify(raw)))).toBe('invalid')
})

test('migrate upgrades an older object with injected migrations', () => {
  const v0 = { formatVersion: 0, name: 'Old', units: 'in', boards: [{ id: 'b1', name: 'A' }], joints: [], woods: [] }
  const up = migrate(v0, {
    0: r => ({ ...r, formatVersion: 1, boards: r.boards.map((b: any) => ({ ...b, holes: [], endCuts: { start: { miter: 0, bevel: 0 }, end: { miter: 0, bevel: 0 } }, edgeBevels: { left: 0, right: 0 } })) }),
    1: r => ({ ...r, formatVersion: 2, sketches: [] }),
    2: r => ({ ...r, formatVersion: 3 }),
    3: r => ({ ...r, formatVersion: 4 }),
    4: r => ({ ...r, formatVersion: 5 }),
    5: r => ({ ...r, formatVersion: 6 }),
    6: r => ({ ...r, formatVersion: 7 }),
    7: r => ({ ...r, formatVersion: 8 }),
    8: r => ({ ...r, formatVersion: 9 }),
    9: r => ({ ...r, formatVersion: 10 }),
    10: r => ({ ...r, formatVersion: 11 })
  })
  expect(up.formatVersion).toBe(FORMAT_VERSION)
  expect(up.sketches).toEqual([])
  expect(up.boards[0].holes).toEqual([])
  expect(up.boards[0].edgeBevels).toEqual({ left: 0, right: 0 })
})
