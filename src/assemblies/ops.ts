// Groups (assemblies) and linked copies. All pure: each returns a new project (or a plain error).
import { type Axis, rotateVec, worldBox, type Box } from '../model/geometry'
import { newId } from '../model/ids'
import { deleteBoards, rotateBoard, type OpError } from '../model/ops'
import type { Board, Group, Joint, Project } from '../model/types'
import { snap64 } from '../model/units'

const clean = (n: number) => Math.round(n * 1e9) / 1e9 + 0

export const groupsOf = (p: Project): Group[] => p.groups ?? []
const byId = (p: Project, id: string | undefined) => (id ? groupsOf(p).find(g => g.id === id) : undefined)

/** The group and every group above it, innermost first. */
export function ancestry(p: Project, gid: string | undefined): Group[] {
  const out: Group[] = []
  const seen = new Set<string>()
  let g = byId(p, gid)
  while (g && !seen.has(g.id)) { out.push(g); seen.add(g.id); g = byId(p, g.parentId) }
  return out
}

/** Every group inside a group (not counting itself). */
export function subgroups(p: Project, gid: string): Group[] {
  const out: Group[] = []
  const walk = (id: string) => { for (const g of groupsOf(p)) if (g.parentId === id) { out.push(g); walk(g.id) } }
  walk(gid)
  return out
}

/** Every part in a group, its sub-groups included. */
export function groupBoardIds(p: Project, gid: string): string[] {
  return p.boards.filter(b => ancestry(p, b.groupId).some(g => g.id === gid)).map(b => b.id)
}

/** The outermost group whose parts are exactly these, if any. */
export function wholeGroup(p: Project, ids: string[]): Group | null {
  if (!ids.length) return null
  const want = new Set(ids)
  const hits = groupsOf(p).filter(g => {
    const have = groupBoardIds(p, g.id)
    return have.length === want.size && have.every(id => want.has(id))
  })
  // Outermost: the one no other hit sits above.
  return hits.find(g => !ancestry(p, g.parentId).some(a => hits.includes(a))) ?? null
}

export function groupBox(p: Project, gid: string): Box | null {
  const boxes = p.boards.filter(b => groupBoardIds(p, gid).includes(b.id)).map(worldBox)
  if (!boxes.length) return null
  const min = { x: Math.min(...boxes.map(b => b.min.x)), y: Math.min(...boxes.map(b => b.min.y)), z: Math.min(...boxes.map(b => b.min.z)) }
  const max = { x: Math.max(...boxes.map(b => b.max.x)), y: Math.max(...boxes.map(b => b.max.y)), z: Math.max(...boxes.map(b => b.max.z)) }
  return { min, max }
}

const withGroups = (p: Project, groups: Group[]): Project => {
  if (groups.length) return { ...p, groups }
  const { groups: _g, ...rest } = p
  return rest
}

/** Drops groups with no parts in them and any reference that points nowhere (or round in a loop). */
export function pruneGroups(p: Project): Project {
  const ids = new Set(groupsOf(p).map(g => g.id))
  // Parents that are missing or make a loop are dropped.
  let groups = groupsOf(p).map(g => (g.parentId && (!ids.has(g.parentId) || g.parentId === g.id) ? { ...g, parentId: undefined } : g))
  for (const g of groups) {
    const seen = new Set<string>([g.id])
    let cur = groups.find(x => x.id === g.parentId)
    while (cur) {
      if (seen.has(cur.id)) { groups = groups.map(x => (x.id === g.id ? { ...x, parentId: undefined } : x)); break }
      seen.add(cur.id)
      cur = groups.find(x => x.id === cur!.parentId)
    }
  }
  groups = groups.map(g => { if (g.parentId) return g; const { parentId: _p, ...rest } = g; return rest })
  let boards = p.boards.map(b => (b.groupId && !ids.has(b.groupId) ? stripGroup(b) : b))
  let q = withGroups({ ...p, boards }, groups)
  // Empty groups go.
  const used = new Set(boards.flatMap(b => ancestry(q, b.groupId).map(g => g.id)))
  groups = groups.filter(g => used.has(g.id))
  boards = boards.map(b => (b.groupId && !used.has(b.groupId) ? stripGroup(b) : b))
  const changed = groups.length !== groupsOf(p).length || boards.some((b, i) => b !== p.boards[i]) || groups.some((g, i) => g !== groupsOf(p)[i])
  return changed ? withGroups({ ...p, boards }, groups) : p
}
function stripGroup(b: Board): Board {
  const { groupId: _g, ...rest } = b
  return rest
}

/** Puts parts into a new group. Whole groups that are selected become its sub-groups. */
export function groupBoards(p: Project, ids: string[], name: string): { project: Project; id: string } | OpError {
  const sel = new Set(ids.filter(id => p.boards.some(b => b.id === id)))
  if (sel.size < 2) return { error: 'Select two or more parts to group' }
  if (!name.trim()) return { error: 'Give the group a name' }
  const covered = new Set(groupsOf(p).filter(g => { const have = groupBoardIds(p, g.id); return have.length > 0 && have.every(id => sel.has(id)) }).map(g => g.id))
  // Items that move: the outermost covered groups, and selected parts not inside a covered group.
  const topGroups = groupsOf(p).filter(g => covered.has(g.id) && !(g.parentId && covered.has(g.parentId)))
  const looseParts = p.boards.filter(b => sel.has(b.id) && !(b.groupId && covered.has(b.groupId)))
  // The new group goes inside the deepest group that holds everything that moves.
  const chains = [...topGroups.map(g => ancestry(p, g.parentId)), ...looseParts.map(b => ancestry(p, b.groupId))]
  const common = chains.length ? chains[0].filter(g => chains.every(c => c.some(x => x.id === g.id))) : []
  const parent = common[0]?.id
  if (topGroups.length === 1 && looseParts.length === 0 && wholeGroup(p, [...sel])?.id === topGroups[0].id) {
    return { error: `These parts are already the group ${topGroups[0].name}` }
  }
  const id = newId('g')
  const group: Group = { id, name: name.trim(), ...(parent ? { parentId: parent } : {}) }
  const groups = [...groupsOf(p).map(g => (topGroups.includes(g) ? { ...g, parentId: id } : g)), group]
  const boards = p.boards.map(b => (looseParts.includes(b) ? { ...b, groupId: id } : b))
  return { project: pruneGroups({ ...p, boards, groups }), id }
}

/** Takes a group apart: its parts and sub-groups move up a level. */
export function ungroup(p: Project, gid: string): Project {
  const g = byId(p, gid)
  if (!g) return p
  const groups = groupsOf(p).filter(x => x.id !== gid).map(x => (x.parentId === gid ? (g.parentId ? { ...x, parentId: g.parentId } : stripParent(x)) : x))
  const boards = p.boards.map(b => (b.groupId === gid ? (g.parentId ? { ...b, groupId: g.parentId } : stripGroup(b)) : b))
  return withGroups({ ...p, boards }, groups)
}
function stripParent(g: Group): Group {
  const { parentId: _p, ...rest } = g
  return rest
}

export function renameGroup(p: Project, gid: string, name: string): Project | OpError {
  if (!name.trim()) return { error: 'Give the group a name' }
  return { ...p, groups: groupsOf(p).map(g => (g.id === gid ? { ...g, name: name.trim() } : g)) }
}

/** Moves a whole group so its box's low corner on `axis` is at `min`. */
export function moveGroup(p: Project, gid: string, axis: Axis, min: number): Project {
  const box = groupBox(p, gid)
  if (!box) return p
  const d = snap64(min) - box.min[axis]
  if (d === 0) return p
  const ids = new Set(groupBoardIds(p, gid))
  return { ...p, boards: p.boards.map(b => (ids.has(b.id) ? { ...b, position: { ...b.position, [axis]: snap64(b.position[axis] + d) } } : b)) }
}

/** Turns a whole group about its centre, as one piece. */
export function rotateGroup(p: Project, gid: string, axis: Axis, degrees: number): Project {
  const box = groupBox(p, gid)
  if (!box) return p
  const gc = { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2, z: (box.min.z + box.max.z) / 2 }
  const turn = { x: 0, y: 0, z: 0, [axis]: degrees }
  let q = p
  for (const id of groupBoardIds(p, gid)) {
    const before = centre(q.boards.find(b => b.id === id)!)
    q = rotateBoard(q, id, axis, degrees)
    const r = rotateVec({ x: before.x - gc.x, y: before.y - gc.y, z: before.z - gc.z }, turn)
    const want = { x: gc.x + r.x, y: gc.y + r.y, z: gc.z + r.z }
    const now = centre(q.boards.find(b => b.id === id)!)
    q = { ...q, boards: q.boards.map(b => (b.id === id ? { ...b, position: { x: clean(b.position.x + want.x - now.x), y: clean(b.position.y + want.y - now.y), z: clean(b.position.z + want.z - now.z) } } : b)) }
  }
  return q
}
const centre = (b: Board) => {
  const w = worldBox(b)
  return { x: (w.min.x + w.max.x) / 2, y: (w.min.y + w.max.y) / 2, z: (w.min.z + w.max.z) / 2 }
}

/**
 * Copies a group (parts, the joints between them, sub-groups) beside itself, to +X by its width + 2".
 * A linked copy stays in step with the original (see syncLinks).
 */
export function copyGroup(p: Project, gid: string, linked: boolean): { project: Project; id: string } | OpError {
  const g = byId(p, gid)
  const box = groupBox(p, gid)
  if (!g || !box) return { error: 'That group has no parts' }
  const shift = snap64(box.max.x - box.min.x + 2)
  const gmap = new Map<string, string>([[gid, newId('g')]])
  for (const s of subgroups(p, gid)) gmap.set(s.id, newId('g'))
  const ids = new Set(groupBoardIds(p, gid))
  const bmap = new Map<string, string>()
  for (const id of ids) bmap.set(id, newId('b'))
  const link = linked ? g.link ?? newId('k') : undefined
  // Linked parts share a key; the original's parts get theirs now if they had none.
  const keys = new Map<string, string>()
  for (const b of p.boards) if (ids.has(b.id)) keys.set(b.id, b.link ?? newId('k'))
  let boards = p.boards.map(b => (linked && ids.has(b.id) && !b.link ? { ...b, link: keys.get(b.id) } : b))
  const copies: Board[] = p.boards.filter(b => ids.has(b.id)).map(b => {
    const c: Board = { ...structuredClone(b), id: bmap.get(b.id)!, position: { ...b.position, x: snap64(b.position.x + shift) }, groupId: gmap.get(b.groupId!) ?? b.groupId }
    if (linked) c.link = keys.get(b.id)
    else delete c.link
    if (!linked && b.groupId === gid) c.groupId = gmap.get(gid)
    if (c.formulas) {
      const { x: _x, y: _y, z: _z, ...rest } = c.formulas
      if (Object.keys(rest).length) c.formulas = rest
      else delete c.formulas
    }
    return c
  })
  boards = [...boards, ...copies]
  const joints: Joint[] = p.joints.filter(j => ids.has(j.hostBoardId) && ids.has(j.partnerBoardId)).map(j => ({
    ...structuredClone(j),
    id: newId('j'),
    hostBoardId: bmap.get(j.hostBoardId)!,
    partnerBoardId: bmap.get(j.partnerBoardId)!,
    restore: j.restore?.map(r => ({ ...r, boardId: bmap.get(r.boardId) ?? r.boardId }))
  }))
  const newGroups: Group[] = [g, ...subgroups(p, gid)].map(x => {
    const c: Group = { ...x, id: gmap.get(x.id)! }
    if (x.id === gid) c.name = linked ? x.name : `${x.name} (copy)`
    if (x.parentId && gmap.has(x.parentId)) c.parentId = gmap.get(x.parentId)
    if (x.id === gid) { if (link) c.link = link; else delete c.link }
    return c
  })
  const groups = [...groupsOf(p).map(x => (x.id === gid && link ? { ...x, link } : x)), ...newGroups]
  return { project: { ...p, boards, joints: [...p.joints, ...joints], groups }, id: gmap.get(gid)! }
}

/** Makes a linked copy independent (its parts keep their current sizes). */
export function unlinkGroup(p: Project, gid: string): Project {
  const g = byId(p, gid)
  if (!g?.link) return p
  const ids = new Set(groupBoardIds(p, gid))
  let groups = groupsOf(p).map(x => (x.id === gid ? stripLink(x) : x))
  let boards = p.boards.map(b => (ids.has(b.id) && b.link ? stripBoardLink(b) : b))
  // A single instance left on its own is no longer linked to anything.
  const rest = groups.filter(x => x.link === g.link)
  if (rest.length === 1) {
    const only = new Set(groupBoardIds({ ...p, groups }, rest[0].id))
    groups = groups.map(x => (x.id === rest[0].id ? stripLink(x) : x))
    boards = boards.map(b => (only.has(b.id) && b.link ? stripBoardLink(b) : b))
  }
  return { ...p, boards, groups }
}
function stripLink(g: Group): Group {
  const { link: _l, ...rest } = g
  return rest
}
function stripBoardLink(b: Board): Board {
  const { link: _l, ...rest } = b
  return rest
}

// ── keeping linked copies in step ─────────────────────────────────────────

const SYNCED = ['name', 'woodId', 'thickness', 'width', 'length', 'grain', 'holes', 'endCuts', 'edgeBevels', 'outline', 'turning', 'taper', 'edges'] as const
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const sizeFormulas = (b: Board) => {
  if (!b.formulas) return undefined
  const { x: _x, y: _y, z: _z, ...rest } = b.formulas
  return Object.keys(rest).length ? rest : undefined
}

/** The linked instance a part belongs to (its nearest group with a link), if any. */
export function instanceOf(p: Project, b: Board): Group | undefined {
  return ancestry(p, b.groupId).find(g => g.link)
}

/**
 * After a change, makes every linked copy match: sizes, wood, features and size formulas of the parts changed in
 * one instance; moves of single parts inside an instance; parts deleted from one; joints added, removed or changed.
 * Moving or turning a whole instance is that instance's own.
 */
export function syncLinks(prev: Project, next: Project): Project {
  if (!next.boards.some(b => b.link) && !prev.boards.some(b => b.link)) return next
  let q = next
  const before = new Map(prev.boards.map(b => [b.id, b]))
  const partner = (inst: Group, key: string, from: Project) =>
    from.boards.find(b => b.link === key && instanceOf(from, b)?.id === inst.id)
  const others = (from: Project, inst: Group) => groupsOf(from).filter(g => g.link === inst.link && g.id !== inst.id)

  // Parts deleted from part of an instance go from the others too.
  const gone = prev.boards.filter(b => b.link && !next.boards.some(x => x.id === b.id))
  const goneBy = new Map<string, Board[]>()
  for (const b of gone) { const i = instanceOf(prev, b); if (i) goneBy.set(i.id, [...(goneBy.get(i.id) ?? []), b]) }
  for (const [iid, list] of goneBy) {
    const inst = byId(prev, iid)!
    const all = prev.boards.filter(b => instanceOf(prev, b)?.id === iid)
    if (list.length === all.length) continue
    const del: string[] = []
    for (const o of others(prev, inst)) for (const b of list) { const m = partner(o, b.link!, q); if (m) del.push(m.id) }
    if (del.length) q = deleteBoards(q, del)
  }

  // Board changes, instance by instance.
  const insts = new Map<string, Board[]>()
  for (const b of next.boards) { const i = instanceOf(next, b); if (i && b.link) insts.set(i.id, [...(insts.get(i.id) ?? []), b]) }
  for (const [iid, list] of insts) {
    const inst = byId(next, iid)!
    const moved = list.filter(b => { const o = before.get(b.id); return o && (!same(o.position, b.position) || !same(o.rotation, b.rotation)) })
    const wholeMove = moved.length === list.length
    for (const b of list) {
      const o = before.get(b.id)
      if (!o) continue
      const patch: Partial<Board> = {}
      for (const k of SYNCED) if (!same(o[k], b[k])) (patch as Record<string, unknown>)[k] = structuredClone(b[k])
      const f = sizeFormulas(b)
      const fChanged = !same(sizeFormulas(o), f)
      const d = { x: b.position.x - o.position.x, y: b.position.y - o.position.y, z: b.position.z - o.position.z }
      const shift = !wholeMove && same(o.rotation, b.rotation) && (d.x || d.y || d.z)
      if (!Object.keys(patch).length && !fChanged && !shift) continue
      for (const og of others(q, inst)) {
        const m = partner(og, b.link!, q)
        if (!m) continue
        let nb: Board = { ...m, ...patch }
        if (fChanged) {
          const xyz = Object.fromEntries(Object.entries(m.formulas ?? {}).filter(([k]) => k === 'x' || k === 'y' || k === 'z'))
          const all = { ...(f ?? {}), ...xyz }
          if (Object.keys(all).length) nb.formulas = all
          else { const { formulas: _f, ...rest } = nb; nb = rest }
        }
        for (const k of SYNCED) if (patch[k] === undefined && b[k] === undefined && m[k] !== undefined && o[k] !== undefined) delete (nb as Record<string, unknown>)[k]
        if (shift && same(m.rotation, o.rotation)) nb = { ...nb, position: { x: snap64(m.position.x + d.x), y: snap64(m.position.y + d.y), z: snap64(m.position.z + d.z) } }
        q = { ...q, boards: q.boards.map(x => (x.id === m.id ? nb : x)) }
      }
    }
  }

  // Joints between linked parts.
  const key = (from: Project, j: Joint) => {
    const h = from.boards.find(b => b.id === j.hostBoardId), pa = from.boards.find(b => b.id === j.partnerBoardId)
    if (!h?.link || !pa?.link) return null
    const i = instanceOf(from, h)
    if (!i || instanceOf(from, pa)?.id !== i.id) return null
    return { inst: i, host: h.link, partner: pa.link }
  }
  const match = (from: Project, inst: Group, k: { host: string; partner: string }, type: string) => {
    const h = partner(inst, k.host, from), pa = partner(inst, k.partner, from)
    return h && pa ? from.joints.find(j => j.type === type && j.hostBoardId === h.id && j.partnerBoardId === pa.id) ?? null : null
  }
  const prevJoints = new Map(prev.joints.map(j => [j.id, j]))
  for (const j of next.joints) {
    const k = key(next, j)
    if (!k) continue
    const old = prevJoints.get(j.id)
    for (const og of others(q, k.inst)) {
      const h = partner(og, k.host, q), pa = partner(og, k.partner, q)
      if (!h || !pa) continue
      const m = match(q, og, k, j.type)
      if (!old && !m) {
        const map = new Map([[j.hostBoardId, h.id], [j.partnerBoardId, pa.id]])
        q = { ...q, joints: [...q.joints, { ...structuredClone(j), id: newId('j'), hostBoardId: h.id, partnerBoardId: pa.id, restore: j.restore?.map(r => ({ ...r, boardId: map.get(r.boardId) ?? r.boardId })) }] }
      } else if (old && m && (!same(old.params, j.params) || !same(old.formulas, j.formulas))) {
        q = { ...q, joints: q.joints.map(x => (x.id === m.id ? { ...x, params: structuredClone(j.params), ...(j.formulas ? { formulas: { ...j.formulas } } : {}), restore: j.restore?.map(r => ({ ...r, boardId: r.boardId === j.hostBoardId ? h.id : r.boardId === j.partnerBoardId ? pa.id : r.boardId })) } : x)) }
      }
    }
  }
  for (const j of prev.joints) {
    if (next.joints.some(x => x.id === j.id)) continue
    const k = key(prev, j)
    if (!k || !next.boards.some(b => b.id === j.hostBoardId) || !next.boards.some(b => b.id === j.partnerBoardId)) continue
    for (const og of others(q, k.inst)) {
      const m = match(q, og, k, j.type)
      if (m) q = { ...q, joints: q.joints.filter(x => x.id !== m.id) }
    }
  }
  return q === next ? next : pruneGroups(q)
}
