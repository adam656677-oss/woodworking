// 3D file readers for reference models: STL, OBJ, 3MF, glTF/GLB and STEP (faceted, and planar B-rep faces).
// Each gives plain triangles (x, y, z per corner; Z up) in the file's own units, and the units when the file says.
import { strFromU8, unzipSync } from 'fflate'
import * as THREE from 'three'

export type FileUnit = 'in' | 'mm' | 'cm' | 'm'
export type ReadResult = { positions: Float32Array; unit?: FileUnit; skipped?: number }
export class ReadError extends Error {}

export const MAX_TRIANGLES = 200_000
export const UNIT_SCALE: Record<FileUnit, number> = { in: 1, mm: 1 / 25.4, cm: 1 / 2.54, m: 1 / 0.0254 }

function done(list: number[], unit?: FileUnit, skipped?: number): ReadResult {
  const tris = list.length / 9
  if (!tris) throw new ReadError('There are no triangles in this file')
  if (tris > MAX_TRIANGLES) throw new ReadError(`This model has ${tris.toLocaleString('en-US')} triangles — ${MAX_TRIANGLES.toLocaleString('en-US')} is the most. Simplify it (decimate) in your modelling program and try again.`)
  return { positions: new Float32Array(list), ...(unit ? { unit } : {}), ...(skipped ? { skipped } : {}) }
}

export function readStl(bytes: Uint8Array): ReadResult {
  const head = strFromU8(bytes.subarray(0, Math.min(bytes.length, 512)))
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const binaryCount = bytes.length >= 84 ? dv.getUint32(80, true) : -1
  if (binaryCount >= 0 && 84 + binaryCount * 50 === bytes.length) {
    const out: number[] = []
    for (let t = 0; t < binaryCount; t++) for (let k = 0; k < 9; k++) out.push(dv.getFloat32(84 + t * 50 + 12 + k * 4, true))
    return done(out)
  }
  if (!/^\s*solid/i.test(head)) throw new ReadError("This doesn't look like an STL file")
  const text = strFromU8(bytes)
  const out: number[] = []
  for (const m of text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) out.push(Number(m[1]), Number(m[2]), Number(m[3]))
  return done(out)
}

export function readObj(text: string): ReadResult {
  const v: number[][] = []
  const out: number[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.startsWith('v ')) v.push(line.slice(2).trim().split(/\s+/).slice(0, 3).map(Number))
    else if (line.startsWith('f ')) {
      const idx = line.slice(2).trim().split(/\s+/).map(t => { const i = parseInt(t.split('/')[0], 10); return i < 0 ? v.length + i : i - 1 })
      for (let k = 1; k + 1 < idx.length; k++) for (const i of [idx[0], idx[k], idx[k + 1]]) {
        const q = v[i]
        if (!q) throw new ReadError('This OBJ file is damaged (a face uses a corner that isn\'t there)')
        out.push(q[0], q[1], q[2])
      }
    }
  }
  return done(out)
}

const attr = (s: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(s)?.[1]

export function read3mf(bytes: Uint8Array): ReadResult {
  let files: Record<string, Uint8Array>
  try { files = unzipSync(bytes) } catch { throw new ReadError("This doesn't look like a 3MF file") }
  const name = Object.keys(files).find(f => /\.model$/i.test(f))
  if (!name) throw new ReadError('There is no model in this 3MF file')
  const x = strFromU8(files[name])
  const unitAttr = attr(/<model\b[^>]*>/.exec(x)?.[0] ?? '', 'unit') ?? 'millimeter'
  const unit: FileUnit = unitAttr === 'inch' ? 'in' : unitAttr === 'centimeter' ? 'cm' : unitAttr === 'meter' ? 'm' : 'mm'
  const objects = new Map<string, number[]>()
  for (const m of x.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
    const id = attr(m[1], 'id')!
    const vs = [...m[2].matchAll(/<vertex\b([^>]*)\/>/g)].map(q => [Number(attr(q[1], 'x')), Number(attr(q[1], 'y')), Number(attr(q[1], 'z'))])
    const tris: number[] = []
    for (const t of m[2].matchAll(/<triangle\b([^>]*)\/>/g)) for (const k of ['v1', 'v2', 'v3']) { const q = vs[Number(attr(t[1], k))]; if (q) tris.push(...q) }
    objects.set(id, tris)
  }
  const out: number[] = []
  const items = [...x.matchAll(/<item\b([^>]*)\/>/g)]
  for (const it of items.length ? items : [...objects.keys()].map(id => [``, `objectid="${id}"`] as unknown as RegExpMatchArray)) {
    const tris = objects.get(attr(it[1], 'objectid') ?? '') ?? []
    const tf = attr(it[1], 'transform')?.trim().split(/\s+/).map(Number)
    for (let i = 0; i < tris.length; i += 3) {
      const [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]]
      out.push(...(tf && tf.length === 12 ? [a * tf[0] + b * tf[3] + c * tf[6] + tf[9], a * tf[1] + b * tf[4] + c * tf[7] + tf[10], a * tf[2] + b * tf[5] + c * tf[8] + tf[11]] : [a, b, c]))
    }
  }
  return done(out, unit)
}

/** glTF 2.0 (.glb, or .gltf with its data embedded). Metres, Y up → turned Z up. */
export function readGltf(bytes: Uint8Array): ReadResult {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let json: any, bin: Uint8Array | null = null
  if (bytes.length > 12 && dv.getUint32(0, true) === 0x46546c67) {
    const jl = dv.getUint32(12, true)
    json = JSON.parse(strFromU8(bytes.subarray(20, 20 + jl)))
    if (bytes.length > 28 + jl) bin = bytes.subarray(28 + jl, 28 + jl + dv.getUint32(20 + jl, true))
  } else {
    try { json = JSON.parse(strFromU8(bytes)) } catch { throw new ReadError("This doesn't look like a glTF file") }
  }
  const buffers: Uint8Array[] = (json.buffers ?? []).map((b: any, i: number) => {
    if (b.uri === undefined && i === 0 && bin) return bin
    const m = /^data:[^;]*;base64,(.*)$/.exec(b.uri ?? '')
    if (!m) throw new ReadError('This glTF file keeps its data in a separate file — export it as a single .glb instead')
    return Uint8Array.from(atob(m[1]), c => c.charCodeAt(0))
  })
  const view = (acc: any): { data: DataView; stride: number; count: number; size: number; type: number } => {
    const bv = json.bufferViews[acc.bufferView]
    const buf = buffers[bv.buffer]
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type as string] ?? 1
    const comp = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[acc.componentType as number] ?? 4
    return { data: new DataView(buf.buffer, buf.byteOffset + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0)), stride: bv.byteStride ?? size * comp, count: acc.count, size, type: acc.componentType }
  }
  const get = (v: ReturnType<typeof view>, i: number, k: number) => {
    const o = i * v.stride + k * (v.type === 5126 || v.type === 5125 ? 4 : v.type === 5123 || v.type === 5122 ? 2 : 1)
    return v.type === 5126 ? v.data.getFloat32(o, true) : v.type === 5125 ? v.data.getUint32(o, true) : v.type === 5123 ? v.data.getUint16(o, true) : v.data.getUint8(o)
  }
  const out: number[] = []
  const visit = (ni: number, parent: THREE.Matrix4) => {
    const node = json.nodes[ni]
    const m = new THREE.Matrix4()
    if (node.matrix) m.fromArray(node.matrix)
    else m.compose(new THREE.Vector3(...(node.translation ?? [0, 0, 0])), new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1])), new THREE.Vector3(...(node.scale ?? [1, 1, 1])))
    const world = parent.clone().multiply(m)
    if (node.mesh !== undefined) for (const prim of json.meshes[node.mesh].primitives) {
      if ((prim.mode ?? 4) !== 4) continue
      const pos = view(json.accessors[prim.attributes.POSITION])
      const idx = prim.indices !== undefined ? view(json.accessors[prim.indices]) : null
      const n = idx ? idx.count : pos.count
      const p = new THREE.Vector3()
      for (let i = 0; i < n; i++) {
        const vi = idx ? get(idx, i, 0) : i
        p.set(get(pos, vi, 0), get(pos, vi, 1), get(pos, vi, 2)).applyMatrix4(world)
        out.push(p.x, -p.z, p.y)
      }
    }
    for (const c of node.children ?? []) visit(c, world)
  }
  const scene = json.scenes?.[json.scene ?? 0]
  for (const ni of scene?.nodes ?? json.nodes?.map((_: unknown, i: number) => i) ?? []) visit(ni, new THREE.Matrix4())
  return done(out, 'm')
}

// ---- STEP ----
type Arg = string | number | null | Arg[] | { ref: number } | { enum: string } | { typed: string; args: Arg[] }
type Ent = { type: string; args: Arg[]; parts?: { type: string; args: Arg[] }[] }

function parseArgs(s: string, i: { at: number }): Arg[] {
  const out: Arg[] = []
  // s[i.at] is '('
  i.at++
  while (i.at < s.length) {
    const c = s[i.at]
    if (c === ')') { i.at++; return out }
    if (c === ',' || c === ' ' || c === '\n' || c === '\r' || c === '\t') { i.at++; continue }
    if (c === '(') { out.push(parseArgs(s, i)); continue }
    if (c === "'") {
      let j = i.at + 1, str = ''
      while (j < s.length) { if (s[j] === "'" && s[j + 1] === "'") { str += "'"; j += 2; continue } if (s[j] === "'") break; str += s[j]; j++ }
      out.push(str); i.at = j + 1; continue
    }
    if (c === '#') { const m = /^#(\d+)/.exec(s.slice(i.at)); out.push({ ref: Number(m![1]) }); i.at += m![0].length; continue }
    if (c === '.') { const m = /^\.([A-Z_0-9]+)\./.exec(s.slice(i.at)); out.push({ enum: m ? m[1] : '' }); i.at += m ? m[0].length : 1; continue }
    if (c === '$' || c === '*') { out.push(null); i.at++; continue }
    const num = /^[-+]?(\d+\.?\d*|\.\d+)(E[-+]?\d+)?/i.exec(s.slice(i.at))
    if (num) { out.push(Number(num[0])); i.at += num[0].length; continue }
    const word = /^[A-Z_][A-Z_0-9]*/i.exec(s.slice(i.at))
    if (word) {
      i.at += word[0].length
      while (s[i.at] === ' ') i.at++
      if (s[i.at] === '(') out.push({ typed: word[0].toUpperCase(), args: parseArgs(s, i) })
      else out.push({ enum: word[0] })
      continue
    }
    i.at++
  }
  return out
}

export function parseStep(text: string): Map<number, Ent> {
  const data = /DATA;([\s\S]*?)ENDSEC;/.exec(text)?.[1]
  if (!data) throw new ReadError("This doesn't look like a STEP file")
  const ents = new Map<number, Ent>()
  // Entities end with ';' outside strings.
  let cur = '', inStr = false
  const flush = () => {
    const m = /^\s*#(\d+)\s*=\s*([\s\S]*)$/.exec(cur)
    cur = ''
    if (!m) return
    const body = m[2].trim()
    if (body.startsWith('(')) {
      // A complex entity: (A(...) B(...))
      const parts = parseArgs(body, { at: 0 }).filter((a): a is { typed: string; args: Arg[] } => !!a && typeof a === 'object' && 'typed' in a)
      ents.set(Number(m[1]), { type: parts.map(p => p.typed).join('+'), args: [], parts: parts.map(p => ({ type: p.typed, args: p.args })) })
    } else {
      const t = /^([A-Z_0-9]+)\s*/i.exec(body)
      if (!t) return
      ents.set(Number(m[1]), { type: t[1].toUpperCase(), args: parseArgs(body, { at: t[0].length }) })
    }
  }
  for (const ch of data) {
    if (ch === "'") inStr = !inStr
    if (ch === ';' && !inStr) { flush(); continue }
    cur += ch
  }
  return ents
}

export function readStep(text: string): ReadResult {
  const ents = parseStep(text)
  const ref = (a: Arg) => (a && typeof a === 'object' && 'ref' in a ? ents.get(a.ref) : undefined)
  const point = (a: Arg): THREE.Vector3 | null => {
    let e = ref(a)
    if (e?.type === 'VERTEX_POINT') e = ref(e.args[1])
    if (e?.type !== 'CARTESIAN_POINT') return null
    const c = e.args[1] as number[]
    return new THREE.Vector3(c[0], c[1], c[2] ?? 0)
  }
  // Units: inches when it says INCH; else the SI length prefix.
  let unit: FileUnit | undefined
  for (const e of ents.values()) {
    if (!e.parts) continue
    const conv = e.parts.find(p => p.type === 'CONVERSION_BASED_UNIT')
    if (conv && e.parts.some(p => p.type === 'LENGTH_UNIT') && /INCH/i.test(String(conv.args[0]))) unit = 'in'
    const si = e.parts.find(p => p.type === 'SI_UNIT')
    if (!unit && si && e.parts.some(p => p.type === 'LENGTH_UNIT')) {
      const pre = (si.args[0] as { enum?: string } | null)?.enum
      unit = pre === 'MILLI' ? 'mm' : pre === 'CENTI' ? 'cm' : pre === undefined || pre === null ? 'm' : 'mm'
    }
  }
  const out: number[] = []
  let skipped = 0
  const loopPoints = (loop: Ent | undefined): THREE.Vector3[] | null => {
    if (!loop) return null
    if (loop.type === 'POLY_LOOP') return (loop.args[1] as Arg[]).map(point).filter((p): p is THREE.Vector3 => !!p)
    if (loop.type === 'EDGE_LOOP') {
      const pts: THREE.Vector3[] = []
      for (const oe of loop.args[1] as Arg[]) {
        const o = ref(oe)
        if (o?.type !== 'ORIENTED_EDGE') return null
        const ec = ref(o.args[3])
        if (ec?.type !== 'EDGE_CURVE') return null
        const curve = ref(ec.args[3])
        if (curve && curve.type !== 'LINE' && curve.type !== 'POLYLINE') return null
        const same = (o.args[4] as { enum?: string })?.enum !== 'F'
        const a = point(ec.args[1]), b = point(ec.args[2])
        if (!a || !b) return null
        pts.push(same ? a : b)
      }
      return pts
    }
    return null
  }
  for (const e of ents.values()) {
    if (!['FACE', 'FACE_SURFACE', 'ADVANCED_FACE'].includes(e.type)) continue
    if (e.type !== 'FACE') {
      const surf = ref(e.args[2])
      if (surf?.type !== 'PLANE') { skipped++; continue }
    }
    const bounds = (e.args[1] as Arg[]).map(ref)
    const loops: THREE.Vector3[][] = []
    let bad = false
    for (const bnd of bounds) {
      const pts = loopPoints(ref(bnd!.args[1]))
      if (!pts || pts.length < 3) { bad = true; break }
      const forward = (bnd!.args[2] as { enum?: string })?.enum !== 'F'
      loops.push(forward ? pts : [...pts].reverse())
      if (bnd!.type === 'FACE_OUTER_BOUND') loops.unshift(loops.pop()!)
    }
    if (bad || !loops.length) { skipped++; continue }
    triangulateFace(loops, out)
  }
  return done(out, unit, skipped)
}

/** A flat face (outer loop and holes) as triangles, keeping the outer loop's winding. */
function triangulateFace(loops: THREE.Vector3[][], out: number[]) {
  const outer = loops[0]
  if (outer.length === 3 && loops.length === 1) { for (const p of outer) out.push(p.x, p.y, p.z); return }
  // Newell's normal, then project onto the plane.
  const n = new THREE.Vector3()
  for (let i = 0; i < outer.length; i++) { const a = outer[i], b = outer[(i + 1) % outer.length]; n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y) }
  n.normalize()
  const u = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0).cross(n).normalize() : new THREE.Vector3(0, 1, 0).cross(n).normalize()
  const v = n.clone().cross(u)
  const to2 = (p: THREE.Vector3) => new THREE.Vector2(p.dot(u), p.dot(v))
  const contour = outer.map(to2), holes = loops.slice(1).map(l => l.map(to2))
  const all = [...outer, ...loops.slice(1).flat()]
  for (const t of THREE.ShapeUtils.triangulateShape(contour, holes)) {
    // Keep the face's own winding (its normal points out of the solid).
    const [a, b, c] = t.map(i => all[i])
    const flip = b.clone().sub(a).cross(c.clone().sub(a)).dot(n) < 0
    for (const p of flip ? [a, c, b] : [a, b, c]) out.push(p.x, p.y, p.z)
  }
}

/** Reads any supported file by its extension. */
export function readModel(fileName: string, bytes: Uint8Array): ReadResult {
  const ext = fileName.toLowerCase().split('.').pop()
  switch (ext) {
    case 'stl': return readStl(bytes)
    case 'obj': return readObj(strFromU8(bytes))
    case '3mf': return read3mf(bytes)
    case 'glb': case 'gltf': return readGltf(bytes)
    case 'step': case 'stp': return readStep(strFromU8(bytes))
    default: throw new ReadError('Pick an STL, OBJ, 3MF, glTF/GLB or STEP file')
  }
}

/** A sensible unit to offer when the file doesn't say: big numbers are probably millimetres. */
export function guessUnit(r: ReadResult): FileUnit {
  if (r.unit) return r.unit
  let span = 0
  const a = r.positions
  for (let k = 0; k < 3; k++) { let lo = Infinity, hi = -Infinity; for (let i = k; i < a.length; i += 3) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]) } span = Math.max(span, hi - lo) }
  return span > 120 ? 'mm' : 'in'
}
