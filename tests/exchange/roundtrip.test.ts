import { strFromU8, unzipSync } from 'fflate'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'
import { boundsOf, partMeshes } from '../../src/exchange/meshes'
import { to3mf, toGlb, toObj, toStep, toStl } from '../../src/exchange/writers'
import { guessUnit, parseStep, read3mf, readGltf, readObj, readStep, readStl, UNIT_SCALE, MAX_TRIANGLES, ReadError } from '../../src/exchange/readers'
import { flatPatterns } from '../../src/exchange/flat'

const shelf = applyTemplate(emptyProject('Bookshelf'), 'bookshelf', {})
const parts = partMeshes(shelf)
const want = boundsOf(parts.map(p => p.positions))
const close = (a: number[], b: number[], tol = 1e-3) => a.every((v, i) => Math.abs(v - b[i]) < tol)
const scaled = (r: { positions: Float32Array; unit?: string }, s = 1) => boundsOf([r.positions.map(v => v * s)])

test('the bookshelf as triangles: 30 × 10 × 36 overall', () => {
  expect(close(want.min, [0, 0, 0])).toBe(true)
  expect(close(want.max, [30, 10, 36])).toBe(true)
})

test('STL: triangle count, normals and bounds; millimetres on request', () => {
  const stl = toStl(parts)
  const tris = parts.reduce((n, p) => n + p.positions.length / 9, 0)
  expect(new DataView(stl.buffer).getUint32(80, true)).toBe(tris)
  expect(stl.length).toBe(84 + tris * 50)
  const back = readStl(stl)
  expect(close(scaled(back).max, want.max)).toBe(true)
  const mm = readStl(toStl(parts, 'mm'))
  expect(close(scaled(mm).max, want.max.map(v => v * 25.4), 0.05)).toBe(true)
  // A normal is unit length and points out of the first triangle's face.
  const dv = new DataView(stl.buffer)
  expect(Math.hypot(dv.getFloat32(84, true), dv.getFloat32(88, true), dv.getFloat32(92, true))).toBeCloseTo(1)
})

test('OBJ: an object per part, a material per wood', () => {
  const { obj, mtl } = toObj(parts, shelf.woods)
  expect(obj.match(/^o /gm)!.length).toBe(parts.length)
  expect(obj).toContain('o Side\n')
  expect(obj).toContain('o Side_2\n')
  expect(mtl).toContain('newmtl')
  expect(close(scaled(readObj(obj)).max, want.max)).toBe(true)
})

test('3MF: named objects in inches, read back', () => {
  const z = to3mf(parts)
  const model = strFromU8(unzipSync(z)['3D/3dmodel.model'])
  expect(model).toContain('unit="inch"')
  expect(model.match(/<object /g)!.length).toBe(parts.length)
  const back = read3mf(z)
  expect(back.unit).toBe('in')
  expect(close(scaled(back).max, want.max)).toBe(true)
})

test('GLB: header, JSON with named nodes, metres, Y up — read back as inches, Z up', () => {
  const glb = toGlb(parts, shelf.woods)
  const dv = new DataView(glb.buffer)
  expect(dv.getUint32(0, true)).toBe(0x46546c67)
  expect(dv.getUint32(8, true)).toBe(glb.length)
  const json = JSON.parse(strFromU8(glb.subarray(20, 20 + dv.getUint32(12, true))))
  expect(json.nodes.filter((n: { mesh?: number }) => n.mesh !== undefined).map((n: { name: string }) => n.name)).toContain('Shelf')
  const back = readGltf(glb)
  expect(back.unit).toBe('m')
  expect(close(scaled(back, UNIT_SCALE.m).max, want.max, 0.01)).toBe(true)
})

test('STEP: faceted solids named per part, in inches; our reader parses them back', () => {
  const step = toStep(parts, 'bookshelf.step')
  expect(step.startsWith('ISO-10303-21;')).toBe(true)
  const ents = parseStep(step)
  expect([...ents.values()].filter(e => e.type === 'FACETED_BREP')).toHaveLength(parts.length)
  expect([...ents.values()].filter(e => e.type === 'PRODUCT').map(e => e.args[0])).toContain('Shelf')
  const back = readStep(step)
  expect(back.unit).toBe('in')
  expect(back.skipped).toBeUndefined()
  expect(close(scaled(back).max, want.max)).toBe(true)
})

test('STEP B-rep: planar faces are read, curved ones skipped and counted', () => {
  // A 10 mm cube as advanced faces with edge loops, plus one cylindrical face.
  const L: string[] = []
  let n = 0
  const e = (s: string) => { n++; L.push(`#${n}=${s};`); return `#${n}` }
  const unit = e(`(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.))`)
  void unit
  const P = (x: number, y: number, z: number) => e(`VERTEX_POINT('',${e(`CARTESIAN_POINT('',(${x},${y},${z}))`)})`)
  const c = [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0], [0, 0, 10], [10, 0, 10], [10, 10, 10], [0, 10, 10]].map(q => P(q[0], q[1], q[2]))
  const plane = e(`PLANE('',$)`)
  const face = (ids: number[]) => {
    const edges = ids.map((v, i) => e(`ORIENTED_EDGE('',*,*,${e(`EDGE_CURVE('',${c[v]},${c[ids[(i + 1) % ids.length]]},${e(`LINE('',$,$)`)},.T.)`)},.T.)`))
    return e(`ADVANCED_FACE('',(${e(`FACE_OUTER_BOUND('',${e(`EDGE_LOOP('',(${edges.join(',')}))`)},.T.)`)}),${plane},.T.)`)
  }
  const faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]].map(face)
  e(`ADVANCED_FACE('',(${e(`FACE_OUTER_BOUND('',${e(`EDGE_LOOP('',())`)},.T.)`)}),${e(`CYLINDRICAL_SURFACE('',$,5.)`)},.T.)`)
  e(`CLOSED_SHELL('',(${faces.join(',')}))`)
  const text = `ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\n${L.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`
  const r = readStep(text)
  expect(r.unit).toBe('mm')
  expect(r.positions.length / 9).toBe(12)
  expect(r.skipped).toBe(1)
  expect(close(boundsOf([r.positions]).max, [10, 10, 10])).toBe(true)
})

test('units are guessed from size when the file doesn\'t say; huge models are refused', () => {
  expect(guessUnit({ positions: new Float32Array([0, 0, 0, 254, 0, 0, 0, 10, 0]) })).toBe('mm')
  expect(guessUnit({ positions: new Float32Array([0, 0, 0, 30, 0, 0, 0, 10, 0]) })).toBe('in')
  const big = `${'v 0 0 0\nv 1 0 0\nv 0 1 0\n'}${'f 1 2 3\n'.repeat(MAX_TRIANGLES + 1)}`
  expect(() => readObj(big)).toThrow(ReadError)
})

test('DXF flat patterns: outlines, a layer for grooves, a label per part', () => {
  const dxf = flatPatterns(shelf)
  expect(dxf).toContain('AC1009')
  expect((dxf.match(/\n8\nOUTLINE\n/g) ?? []).length).toBe(shelf.boards.length * 4)
  expect(dxf).toContain('\n8\nGROOVES\n')
  expect(dxf).toContain('\n1\nSide 10" x 36"\n')
})
