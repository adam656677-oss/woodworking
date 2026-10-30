// 3D file writers: STL, OBJ (+MTL), 3MF, GLB and STEP. Input: world-inch triangles per part.
import { zipSync, strToU8 } from 'fflate'
import type { Wood } from '../model/types'
import { normalOf, uniqueNames, weld, type PartMesh } from './meshes'

export type Units = 'in' | 'mm'
const scaleOf = (u: Units) => (u === 'mm' ? 25.4 : 1)
const num = (v: number) => String(Math.round(v * 1e6) / 1e6 + 0)

/** Binary STL: every part's triangles in one mesh. */
export function toStl(parts: PartMesh[], units: Units = 'in'): Uint8Array {
  const s = scaleOf(units)
  const count = parts.reduce((n, p) => n + p.positions.length / 9, 0)
  const buf = new ArrayBuffer(84 + count * 50)
  const dv = new DataView(buf)
  const header = `A&A Woodworking Studio STL, units: ${units === 'mm' ? 'millimetres' : 'inches'}`
  for (let i = 0; i < Math.min(80, header.length); i++) dv.setUint8(i, header.charCodeAt(i))
  dv.setUint32(80, count, true)
  let o = 84
  for (const p of parts) for (let i = 0; i < p.positions.length; i += 9) {
    const n = normalOf(p.positions, i)
    for (let k = 0; k < 3; k++) { dv.setFloat32(o, n[k], true); o += 4 }
    for (let k = 0; k < 9; k++) { dv.setFloat32(o, p.positions[i + k] * s, true); o += 4 }
    dv.setUint16(o, 0, true); o += 2
  }
  return new Uint8Array(buf)
}

/** A wood's colour for files that carry colour (sheet goods paler, hardwood darker). */
export function woodColour(w: Wood | undefined): [number, number, number] {
  if (!w) return [0.8, 0.68, 0.5]
  if (w.kind === 'sheet') return w.species.toLowerCase() === 'mdf' ? [0.62, 0.52, 0.42] : [0.86, 0.76, 0.58]
  if (w.kind === 'hardwood') return [0.62, 0.42, 0.26]
  return [0.85, 0.72, 0.52]
}

/** OBJ with one named object per part and a material per wood, and its MTL. */
export function toObj(parts: PartMesh[], woods: Wood[], units: Units = 'in', mtlName = 'design.mtl'): { obj: string; mtl: string } {
  const s = scaleOf(units)
  const names = uniqueNames(parts.map(p => p.name))
  const mats = uniqueNames(woods.map(w => w.name))
  const matOf = (id: string) => mats[woods.findIndex(w => w.id === id)] ?? 'Wood'
  const lines = [`# A&A Woodworking Studio — units: ${units === 'mm' ? 'millimetres' : 'inches'}`, `mtllib ${mtlName}`]
  let base = 1
  parts.forEach((p, k) => {
    const { vertices, indices } = weld(p.positions)
    lines.push(`o ${names[k]}`, `usemtl ${matOf(p.woodId)}`)
    for (let i = 0; i < vertices.length; i += 3) lines.push(`v ${num(vertices[i] * s)} ${num(vertices[i + 1] * s)} ${num(vertices[i + 2] * s)}`)
    for (let i = 0; i < indices.length; i += 3) lines.push(`f ${indices[i] + base} ${indices[i + 1] + base} ${indices[i + 2] + base}`)
    base += vertices.length / 3
  })
  const used = new Set(parts.map(p => p.woodId))
  const mtl = woods.filter(w => used.has(w.id)).flatMap(w => { const c = woodColour(w); return [`newmtl ${matOf(w.id)}`, `Kd ${c.map(num).join(' ')}`, 'Ka 0 0 0', 'd 1', ''] })
  return { obj: lines.join('\n') + '\n', mtl: mtl.join('\n') }
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 3MF: one named object per part, in inches (3MF says so in the file). */
export function to3mf(parts: PartMesh[]): Uint8Array {
  const names = parts.map(p => p.name)
  const objects = parts.map((p, k) => {
    const { vertices, indices } = weld(p.positions)
    const vs: string[] = [], ts: string[] = []
    for (let i = 0; i < vertices.length; i += 3) vs.push(`<vertex x="${num(vertices[i])}" y="${num(vertices[i + 1])}" z="${num(vertices[i + 2])}"/>`)
    for (let i = 0; i < indices.length; i += 3) ts.push(`<triangle v1="${indices[i]}" v2="${indices[i + 1]}" v3="${indices[i + 2]}"/>`)
    return `<object id="${k + 1}" name="${xml(names[k])}" type="model"><mesh><vertices>${vs.join('')}</vertices><triangles>${ts.join('')}</triangles></mesh></object>`
  })
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="inch" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Application">A&amp;A Woodworking Studio</metadata>
<resources>${objects.join('')}</resources>
<build>${parts.map((_, k) => `<item objectid="${k + 1}"/>`).join('')}</build>
</model>`
  const types = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`
  return zipSync({ '[Content_Types].xml': strToU8(types), '_rels/.rels': strToU8(rels), '3D/3dmodel.model': strToU8(model) })
}

/** Binary glTF: a node per part (named, wood colour), grouped under nodes for its groups; metres, Y up. */
export function toGlb(parts: PartMesh[], woods: Wood[]): Uint8Array {
  const M = 0.0254
  const chunks: Uint8Array[] = []
  let offset = 0
  const bufferViews: object[] = [], accessors: object[] = [], meshes: object[] = [], materials: object[] = [], nodes: { name: string; mesh?: number; children?: number[] }[] = []
  const matIndex = new Map<string, number>()
  const pad4 = (n: number) => (n + 3) & ~3
  const add = (bytes: Uint8Array, target: number) => {
    const at = offset
    const padded = new Uint8Array(pad4(bytes.length))
    padded.set(bytes)
    chunks.push(padded)
    offset += padded.length
    bufferViews.push({ buffer: 0, byteOffset: at, byteLength: bytes.length, target })
    return bufferViews.length - 1
  }
  const root: number[] = []
  const groupNodes = new Map<string, number>()
  parts.forEach(p => {
    const { vertices, indices } = weld(p.positions)
    if (!indices.length) return
    // glTF is Y-up in metres: (x, y, z) inches → (x, z, −y) metres.
    const v = new Float32Array(vertices.length)
    for (let i = 0; i < vertices.length; i += 3) { v[i] = vertices[i] * M; v[i + 1] = vertices[i + 2] * M; v[i + 2] = -vertices[i + 1] * M }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < v.length; i++) { min[i % 3] = Math.min(min[i % 3], v[i]); max[i % 3] = Math.max(max[i % 3], v[i]) }
    const ix = new Uint32Array(indices)
    const vb = add(new Uint8Array(v.buffer), 34962), ib = add(new Uint8Array(ix.buffer), 34963)
    accessors.push({ bufferView: vb, componentType: 5126, count: v.length / 3, type: 'VEC3', min, max })
    accessors.push({ bufferView: ib, componentType: 5125, count: ix.length, type: 'SCALAR' })
    if (!matIndex.has(p.woodId)) {
      const w = woods.find(x => x.id === p.woodId)
      materials.push({ name: w?.name ?? 'Wood', pbrMetallicRoughness: { baseColorFactor: [...woodColour(w), 1], metallicFactor: 0, roughnessFactor: 0.8 } })
      matIndex.set(p.woodId, materials.length - 1)
    }
    meshes.push({ name: p.name, primitives: [{ attributes: { POSITION: accessors.length - 2 }, indices: accessors.length - 1, material: matIndex.get(p.woodId) }] })
    nodes.push({ name: p.name, mesh: meshes.length - 1 })
    const me = nodes.length - 1
    // Nest under group nodes (made on first use).
    let parent: number | null = null
    p.path.forEach((g, depth) => {
      const key = p.path.slice(0, depth + 1).join('\u0000')
      if (!groupNodes.has(key)) {
        nodes.push({ name: g, children: [] })
        groupNodes.set(key, nodes.length - 1)
        if (parent === null) root.push(nodes.length - 1)
        else nodes[parent].children!.push(nodes.length - 1)
      }
      parent = groupNodes.get(key)!
    })
    if (parent === null) root.push(me)
    else nodes[parent as number].children!.push(me)
  })
  const bin = new Uint8Array(offset)
  let o = 0
  for (const c of chunks) { bin.set(c, o); o += c.length }
  const json = { asset: { version: '2.0', generator: 'A&A Woodworking Studio' }, scene: 0, scenes: [{ nodes: root }], nodes, meshes, materials, accessors, bufferViews, buffers: [{ byteLength: bin.length }] }
  let jsonBytes = strToU8(JSON.stringify(json))
  const jl = pad4(jsonBytes.length)
  const jp = new Uint8Array(jl).fill(0x20)
  jp.set(jsonBytes)
  jsonBytes = jp
  const total = 12 + 8 + jl + 8 + bin.length
  const out = new Uint8Array(total)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true)
  dv.setUint32(12, jl, true); dv.setUint32(16, 0x4e4f534a, true); out.set(jsonBytes, 20)
  dv.setUint32(20 + jl, bin.length, true); dv.setUint32(24 + jl, 0x004e4942, true); out.set(bin, 28 + jl)
  return out
}

/** STEP AP214: each part a closed faceted solid (FACETED_BREP of triangles), named, in inches. */
export function toStep(parts: PartMesh[], fileName: string): string {
  const lines: string[] = []
  let n = 0
  const e = (s: string) => { n++; lines.push(`#${n}=${s};`); return `#${n}` }
  const str = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/[^\x20-\x7e]/g, '_')}'`
  const ctxApp = e(`APPLICATION_CONTEXT('automotive design')`)
  e(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,${ctxApp})`)
  const mm = e(`(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.))`)
  const conv = e(`LENGTH_MEASURE_WITH_UNIT(LENGTH_MEASURE(25.4),${mm})`)
  const dim = e(`DIMENSIONAL_EXPONENTS(1.,0.,0.,0.,0.,0.,0.)`)
  const len = e(`(CONVERSION_BASED_UNIT('INCH',${conv}) LENGTH_UNIT() NAMED_UNIT(${dim}))`)
  const rad = e(`(NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.))`)
  const sr = e(`(NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT())`)
  const unc = e(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-05),${len},'distance_accuracy_value','confusion accuracy')`)
  const ctx = e(`(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((${unc})) GLOBAL_UNIT_ASSIGNED_CONTEXT((${len},${rad},${sr})) REPRESENTATION_CONTEXT('Context','3D'))`)
  const pc = e(`PRODUCT_CONTEXT('',${ctxApp},'mechanical')`)
  const pdc = e(`PRODUCT_DEFINITION_CONTEXT('part definition',${ctxApp},'design')`)
  const origin = e(`CARTESIAN_POINT('',(0.,0.,0.))`)
  const axis = e(`AXIS2_PLACEMENT_3D('',${origin},$,$)`)
  const names = uniqueNames(parts.map(p => p.name))
  parts.forEach((p, k) => {
    const { vertices, indices } = weld(p.positions)
    const pts: string[] = []
    for (let i = 0; i < vertices.length; i += 3) pts.push(e(`CARTESIAN_POINT('',(${num(vertices[i])},${num(vertices[i + 1])},${num(vertices[i + 2])}))`))
    const faces: string[] = []
    // Each triangle a FACE_SURFACE on its PLANE, as faceted B-reps must be.
    const V = (k: number) => [vertices[k * 3], vertices[k * 3 + 1], vertices[k * 3 + 2]]
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [V(indices[i]), V(indices[i + 1]), V(indices[i + 2])]
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      const nv = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
      const nl = Math.hypot(nv[0], nv[1], nv[2]), ul = Math.hypot(u[0], u[1], u[2])
      if (!(nl > 0) || !(ul > 0)) continue
      const dir = (d: number[], l: number) => e(`DIRECTION('',(${d.map(x => num(x / l)).join(',')}))`)
      const plane = e(`PLANE('',${e(`AXIS2_PLACEMENT_3D('',${pts[indices[i]]},${dir(nv, nl)},${dir(u, ul)})`)})`)
      const loop = e(`POLY_LOOP('',(${pts[indices[i]]},${pts[indices[i + 1]]},${pts[indices[i + 2]]}))`)
      const bound = e(`FACE_OUTER_BOUND('',${loop},.T.)`)
      faces.push(e(`FACE_SURFACE('',(${bound}),${plane},.T.)`))
    }
    const shell = e(`CLOSED_SHELL('',(${faces.join(',')}))`)
    const brep = e(`FACETED_BREP(${str(names[k])},${shell})`)
    const rep = e(`FACETED_BREP_SHAPE_REPRESENTATION(${str(names[k])},(${axis},${brep}),${ctx})`)
    const prod = e(`PRODUCT(${str(names[k])},${str(p.name)},'',(${pc}))`)
    const form = e(`PRODUCT_DEFINITION_FORMATION('','',${prod})`)
    const pd = e(`PRODUCT_DEFINITION('design','',${form},${pdc})`)
    const pds = e(`PRODUCT_DEFINITION_SHAPE('','',${pd})`)
    e(`SHAPE_DEFINITION_REPRESENTATION(${pds},${rep})`)
  })
  const stamp = new Date().toISOString().slice(0, 19)
  return [
    'ISO-10303-21;', 'HEADER;',
    `FILE_DESCRIPTION(('A&A Woodworking Studio faceted model'),'2;1');`,
    `FILE_NAME(${str(fileName)},'${stamp}',(''),(''),'A&A Woodworking Studio','A&A Woodworking Studio','');`,
    `FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));`, 'ENDSEC;', 'DATA;', ...lines, 'ENDSEC;', 'END-ISO-10303-21;', ''
  ].join('\n')
}
