// 3D file readers for reference models: STL, OBJ, 3MF, glTF/GLB and STEP (faceted, and planar B-rep faces).
// Each gives plain triangles (x, y, z per corner; Z up) in the file's own units, and the units when the file says.
import { strFromU8, unzipSync } from 'fflate'
import * as THREE from 'three'

export type FileUnit = 'in' | 'mm' | 'cm' | 'm'
export type ReadResult = { positions: Float32Array; unit?: FileUnit; skipped?: number; assembly?: boolean }
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
  const looksBinary = binaryCount >= 0 && (84 + binaryCount * 50 === bytes.length || (!/^\s*solid/i.test(head) && 84 + binaryCount * 50 <= bytes.length))
  if (looksBinary && binaryCount > MAX_TRIANGLES) throw new ReadError(`This model has ${binaryCount.toLocaleString('en-US')} triangles — ${MAX_TRIANGLES.toLocaleString('en-US')} is the most. Simplify it (decimate) in your modelling program and try again.`)
  if (looksBinary) {
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
    if (/^v\s/.test(line)) v.push(line.slice(2).trim().split(/\s+/).slice(0, 3).map(Number))
    else if (/^f\s/.test(line)) {
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

const attr = (s: string, name: string) => new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(s)?.slice(1).find(v => v !== undefined)
/** A 3MF transform (3 × 4, row vectors) applied to a point, and two transforms combined (first, then second). */
type Tf = number[]
const IDENT: Tf = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]
const apply = (t: Tf, a: number, b: number, c: number) => [a * t[0] + b * t[3] + c * t[6] + t[9], a * t[1] + b * t[4] + c * t[7] + t[10], a * t[2] + b * t[5] + c * t[8] + t[11]]
function then(f: Tf, g: Tf): Tf {
  const out: Tf = new Array(12).fill(0)
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) out[r * 3 + c] = f[r * 3] * g[c] + f[r * 3 + 1] * g[3 + c] + f[r * 3 + 2] * g[6 + c] + (r === 3 ? g[9 + c] : 0)
  return out
}
const tfOf = (s: string) => { const t = attr(s, 'transform')?.trim().split(/\s+/).map(Number); return t && t.length === 12 && t.every(Number.isFinite) ? t : IDENT }

export function read3mf(bytes: Uint8Array): ReadResult {
  let files: Record<string, Uint8Array>
  try { files = unzipSync(bytes) } catch { throw new ReadError("This doesn't look like a 3MF file") }
  const norm = (p: string) => p.replace(/^\/+/, '')
  // The root model is the one the package names; otherwise the usual place, or any model.
  const rels = files['_rels/.rels'] ? strFromU8(files['_rels/.rels']) : ''
  const named = /Target\s*=\s*"([^"]+)"[^>]*3dmodel/.exec(rels)?.[1] ?? /3dmodel[^>]*Target\s*=\s*"([^"]+)"/.exec(rels)?.[1]
  const rootPath = [named && norm(named), '3D/3dmodel.model', Object.keys(files).find(f => /\.model$/i.test(f))].find(p => p && files[p])
  if (!rootPath) throw new ReadError('There is no model in this 3MF file')
  const parsed = new Map<string, Map<string, { mesh?: number[]; comps: { path?: string; id: string; tf: Tf }[] }>>()
  const modelText = (path: string) => (files[path] ? strFromU8(files[path]) : '')
  const objectsOf = (path: string) => {
    let m = parsed.get(path)
    if (m) return m
    m = new Map()
    for (const o of modelText(path).matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
      const vs = [...o[2].matchAll(/<vertex\b([^>]*)\/>/g)].map(q => [Number(attr(q[1], 'x')), Number(attr(q[1], 'y')), Number(attr(q[1], 'z'))])
      const tris: number[] = []
      for (const t of o[2].matchAll(/<triangle\b([^>]*)\/>/g)) {
        const corners = ['v1', 'v2', 'v3'].map(k => vs[Number(attr(t[1], k))])
        if (corners.every(Boolean)) for (const q of corners) tris.push(...q)
      }
      const comps = [...o[2].matchAll(/<component\b([^>]*)\/>/g)].map(c => ({ path: attr(c[1], 'p:path'), id: attr(c[1], 'objectid') ?? '', tf: tfOf(c[1]) }))
      m.set(attr(o[1], 'id') ?? '', { ...(/<mesh\b/.test(o[2]) ? { mesh: tris } : {}), comps })
    }
    parsed.set(path, m)
    return m
  }
  const out: number[] = []
  const emit = (path: string, id: string, tf: Tf, depth: number) => {
    const ob = objectsOf(path).get(id)
    if (!ob || depth > 16) return
    if (ob.mesh) for (let i = 0; i < ob.mesh.length; i += 3) out.push(...apply(tf, ob.mesh[i], ob.mesh[i + 1], ob.mesh[i + 2]))
    for (const c of ob.comps) emit(c.path ? norm(c.path) : path, c.id, then(c.tf, tf), depth + 1)
  }
  const root = modelText(rootPath)
  const items = [...root.matchAll(/<item\b([^>]*)\/>/g)]
  if (items.length) for (const it of items) emit(rootPath, attr(it[1], 'objectid') ?? '', tfOf(it[1]), 0)
  else for (const id of objectsOf(rootPath).keys()) emit(rootPath, id, IDENT, 0)
  // Units: inches, millimetres (also microns and centimetres, converted), feet and metres.
  const u = attr(/<model\b[^>]*>/.exec(root)?.[0] ?? '', 'unit') ?? 'millimeter'
  const conv: Record<string, [FileUnit, number]> = { micron: ['mm', 0.001], millimeter: ['mm', 1], centimeter: ['cm', 1], inch: ['in', 1], foot: ['in', 12], meter: ['m', 1] }
  const [unit, k] = conv[u] ?? ['mm', 1]
  return done(k === 1 ? out : out.map(v => v * k), unit)
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
  // With no scene, the nodes that aren't anyone's child.
  const children = new Set<number>((json.nodes ?? []).flatMap((n: { children?: number[] }) => n.children ?? []))
  for (const ni of scene?.nodes ?? json.nodes?.map((_: unknown, i: number) => i).filter((i: number) => !children.has(i)) ?? []) visit(ni, new THREE.Matrix4())
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
  const circlePoints = (c: Ent, a: THREE.Vector3, b: THREE.Vector3, ccw: boolean): THREE.Vector3[] | null => {
    const ax = ref(c.args[1]), r = c.args[2] as number
    if (ax?.type !== 'AXIS2_PLACEMENT_3D' || !(r > 0)) return null
    const centre = point(ax.args[1])
    const dir = (x: Arg) => { const d = ref(x); return d?.type === 'DIRECTION' ? new THREE.Vector3(...(d.args[1] as [number, number, number])).normalize() : null }
    const z = dir(ax.args[2]) ?? new THREE.Vector3(0, 0, 1)
    let x = dir(ax.args[3]) ?? (Math.abs(z.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0))
    x = x.sub(z.clone().multiplyScalar(x.dot(z))).normalize()
    const y = z.clone().cross(x)
    if (!centre) return null
    const ang = (p: THREE.Vector3) => { const d = p.clone().sub(centre); return Math.atan2(d.dot(y), d.dot(x)) }
    const a0 = ang(a), a1 = ang(b)
    let sweep = ccw ? a1 - a0 : a0 - a1
    while (sweep <= 1e-9) sweep += 2 * Math.PI
    const n = Math.max(2, Math.ceil((sweep / (2 * Math.PI)) * 32))
    return Array.from({ length: n + 1 }, (_, i) => {
      const t = a0 + (ccw ? 1 : -1) * (sweep * i) / n
      return centre.clone().add(x.clone().multiplyScalar(r * Math.cos(t))).add(y.clone().multiplyScalar(r * Math.sin(t)))
    })
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
        const same = (o.args[4] as { enum?: string })?.enum !== 'F'
        const a = point(ec.args[1]), b = point(ec.args[2])
        if (!a || !b) return null
        if (curve && curve.type === 'CIRCLE') {
          // A circle or arc: points around it from start to end, the way the edge runs.
          const arc = circlePoints(curve, a, b, (ec.args[4] as { enum?: string })?.enum !== 'F')
          if (!arc) return null
          pts.push(...(same ? arc.slice(0, -1) : [...arc].reverse().slice(0, -1)))
          continue
        }
        if (curve && curve.type !== 'LINE' && curve.type !== 'POLYLINE') return null
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
  const r = done(out, unit, skipped)
  // Assemblies place their parts with transforms this reader doesn't follow: say so.
  if ([...ents.values()].some(e => e.type === 'MAPPED_ITEM' || e.type === 'CONTEXT_DEPENDENT_SHAPE_REPRESENTATION' || e.parts?.some(p => p.type === 'REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION'))) r.assembly = true
  return r
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
