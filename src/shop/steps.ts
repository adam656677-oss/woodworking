// Steps for Shop Mode: from a plan's own steps, a kid project, or worked out from a design.
import { joineryNotes, STYLE_NAMES } from '../joinery/cuts'
import { finishById } from '../finish/finishes'
import { kidFinish } from '../finish/kids'
import { stepText } from '../finish/schedule'
import { ancestry } from '../assemblies/ops'
import { cutList } from '../model/cutlist'
import type { Board, ButtParams, GrooveParams, Joint, JoineryParams, MiterParams, PocketParams, Project } from '../model/types'
import { formatInches } from '../model/units'
import { TOOLS } from '../kids/content'
import { adultDoes } from '../kids/logic'
import type { KidProject, Tier } from '../kids/types'

export type ShopPart = { qty: number; name: string; size: string }
export type ShopStep = {
  /** Stable key for progress (a plan step id, or cut / joint:<id> / group:<id> / final). */
  key: string
  title: string
  text: string
  tools: string[]
  parts: ShopPart[]
  /** Parts to show in the 3D picture. */
  boardIds?: string[]
  photo?: string
  /** A step the child's tier says a grown-up does. */
  adult?: boolean
}

export type ShopProgress = { done: string[]; minutes: Record<string, number> }
export const emptyProgress = (): ShopProgress => ({ done: [], minutes: {} })

const name = (p: Project, id: string) => p.boards.find(b => b.id === id)?.name ?? '?'
const inches = (v: number) => formatInches(v)

/** One sentence for what a joint asks you to do at the bench. */
export function jointStep(p: Project, j: Joint): { title: string; text: string; tools: string[]; cut: boolean } {
  const host = name(p, j.hostBoardId), partner = name(p, j.partnerBoardId)
  switch (j.type) {
    case 'joinery': {
      const jp = j.params as JoineryParams
      const notes = [...joineryNotes(p, j, j.hostBoardId), ...joineryNotes(p, j, j.partnerBoardId)]
      const tools: Record<string, string[]> = {
        dowel: ['Doweling jig', 'Drill'], biscuit: ['Biscuit joiner'], looseTenon: ['Loose-tenon joiner or router'], dovetail: ['Dovetail saw', 'Chisels', 'Marking gauge'],
        halfBlindDovetail: ['Dovetail saw', 'Chisels', 'Marking gauge'], boxJoint: ['Table saw with box-joint jig'], mortiseTenon: ['Mortiser or chisels', 'Tenon saw or table saw'],
        tongueGroove: ['Router table or table saw'], spline: ['Table saw or router'], bridle: ['Table saw with tenoning jig'], halfLap: ['Table saw or router']
      }
      return { title: `${STYLE_NAMES[jp.style]}: ${partner} to ${host}`, text: `${notes.join('. ')}.`, tools: tools[jp.style] ?? ['Japanese saws', 'Chisels'], cut: true }
    }
    case 'dado':
    case 'rabbet': {
      const g = j.params as GrooveParams
      if (g.face === 'left' || g.face === 'right') {
        return { title: `Groove the edge of ${host}`, text: `Cut a groove along the inside edge of ${host} for ${partner}: ${inches(g.width)} wide, ${inches(g.depth)} deep, centred on the edge.`, tools: ['Table saw or router', 'Slot cutter or 1/4" blade'], cut: true }
      }
      const where = j.type === 'rabbet' ? `along the ${g.offset < 1e-6 ? 'near' : 'far'} ${g.along === 'length' ? 'edge' : 'end'}` : `${inches(g.offset)} from the ${g.along === 'length' ? 'edge' : 'end'}`
      return {
        title: `Cut the ${j.type} in ${host}`,
        text: `Cut a ${j.type} in ${host} for ${partner}: ${inches(g.width)} wide, ${inches(g.depth)} deep, ${where}, on the ${g.face} face.`,
        tools: ['Table saw or router', 'Dado stack or straight bit'],
        cut: true
      }
    }
    case 'miter': {
      const m = j.params as MiterParams
      return { title: `Miter ${host} and ${partner}`, text: `Cut ${m.angle}° miters where ${host} meets ${partner}, then join them with ${m.fastener}.`, tools: ['Miter saw'], cut: true }
    }
    case 'pocketScrew': {
      const q = j.params as PocketParams
      return {
        title: `Drill pocket holes in ${partner}`,
        text: `Drill ${q.count} pocket hole${q.count === 1 ? '' : 's'} in ${partner}${q.count > 1 ? `, ${inches(q.spacing)} apart` : ''}, to join it to ${host} with ${inches(q.screwLength)} pocket screws.`,
        tools: ['Pocket-hole jig', 'Drill/driver'],
        cut: true
      }
    }
    case 'butt': {
      const b = j.params as ButtParams
      const how = b.fastener === 'glue' ? 'glue' : `${b.count} ${b.fastener === 'screws' ? 'screw' : 'nail'}${b.count === 1 ? '' : 's'}`
      return { title: `Join ${partner} to ${host}`, text: `Butt ${partner} against ${host} and fasten with ${how}.`, tools: b.fastener === 'glue' ? ['Glue', 'Clamps'] : b.fastener === 'screws' ? ['Drill/driver'] : ['Hammer'], cut: false }
    }
  }
}

/**
 * Steps worked out from a design: cut the parts, cut each joint, put each group together (inside-out), then the
 * final assembly of whatever is left.
 */
export function stepsFromDesign(p: Project): ShopStep[] {
  const steps: ShopStep[] = []
  const rows = cutList(p).rows
  if (!rows.length) return steps
  steps.push({
    key: 'cut', title: 'Cut the parts', text: `Cut ${rows.reduce((s, r) => s + r.qty, 0)} parts to size. Label each one as you go.`,
    tools: ['Tape measure', 'Square', 'Saw'],
    parts: rows.map(r => ({ qty: r.qty, name: r.part, size: `${inches(r.thickness)} × ${inches(r.width)} × ${inches(r.length)}` })),
    boardIds: p.boards.map(b => b.id)
  })
  const assembly: Joint[] = []
  for (const j of p.joints) {
    const s = jointStep(p, j)
    if (s.cut) steps.push({ key: `joint:${j.id}`, title: s.title, text: s.text, tools: s.tools, parts: [], boardIds: [j.hostBoardId, j.partnerBoardId] })
    assembly.push(j)
  }
  // Groups inside-out: deepest first.
  const groups = [...(p.groups ?? [])].sort((a, b) => ancestry(p, b.id).length - ancestry(p, a.id).length)
  const used = new Set<string>()
  const inGroup = (b: Board, gid: string) => ancestry(p, b.groupId).some(g => g.id === gid)
  for (const g of groups) {
    const ids = p.boards.filter(b => inGroup(b, g.id)).map(b => b.id)
    const js = assembly.filter(j => !used.has(j.id) && ids.includes(j.hostBoardId) && ids.includes(j.partnerBoardId))
    js.forEach(j => used.add(j.id))
    const how = js.map(j => `${name(p, j.partnerBoardId)} to ${name(p, j.hostBoardId)}`)
    steps.push({
      key: `group:${g.id}`, title: `Assemble ${g.name}`,
      text: how.length ? `Dry-fit, then join: ${how.join('; ')}. Check it's square.` : `Put the ${g.name} parts together. Check it's square.`,
      tools: ['Clamps', 'Square'], parts: [], boardIds: ids
    })
  }
  const rest = assembly.filter(j => !used.has(j.id))
  if (rest.length || groups.length) {
    steps.push({
      key: 'final', title: 'Final assembly',
      text: rest.length ? `Dry-fit everything, then join: ${rest.map(j => `${name(p, j.partnerBoardId)} to ${name(p, j.hostBoardId)}`).join('; ')}. Check it's square before the glue sets.` : 'Bring the assemblies together and fasten them. Check it\'s square.',
      tools: ['Clamps', 'Square'], parts: [], boardIds: p.boards.map(b => b.id)
    })
  }
  // The finishing schedule, step by step.
  for (const st of p.finish?.steps ?? []) {
    const f = st.finishId ? finishById(st.finishId) : undefined
    steps.push({
      key: `finish:${st.id}`, title: `Finish: ${st.title}`, text: stepText(st) || st.title,
      tools: st.kind === 'prep' ? ['Sandpaper'] : f ? [st.method === 'spray' ? 'Spray gun' : st.method === 'brush' ? 'Brush' : 'Rags'] : [],
      parts: [], boardIds: p.boards.map(b => b.id)
    })
  }
  return steps
}

const toolName = (id: string) => TOOLS[id]?.name ?? id

/** A plan's own steps; with a child's tier, steps whose tool is beyond it are marked "Adult does this". */
export function stepsFromPlan(plan: { steps: { id: string; text: string; tool?: string; photo?: string }[] }, tier?: Tier): ShopStep[] {
  return plan.steps.map((s, i) => ({
    key: s.id, title: `Step ${i + 1}`, text: s.text, tools: s.tool ? [toolName(s.tool)] : [], parts: [],
    ...(s.photo ? { photo: s.photo } : {}),
    ...(tier && adultDoes(s.tool, tier) ? { adult: true } : {})
  }))
}

/** A kids' project's steps, marked for the child's tier. */
export function stepsFromKid(proj: KidProject, tier: Tier): ShopStep[] {
  // The project's own steps, then its finishing steps.
  const fin = kidFinish(proj)
  const all = [...proj.steps, ...(fin?.steps ?? [])]
  return all.map((s, i) => ({
    key: `${proj.id}:${i}`, title: i < proj.steps.length ? `Step ${i + 1}` : `Finish ${i - proj.steps.length + 1}`, text: s.text, tools: s.tool ? [toolName(s.tool)] : [], parts: [],
    ...(adultDoes(s.tool, tier) ? { adult: true } : {})
  }))
}

/** Marks a step done or not done. */
export function toggleDone(p: ShopProgress, key: string): ShopProgress {
  return { ...p, done: p.done.includes(key) ? p.done.filter(k => k !== key) : [...p.done, key] }
}
/** Adds timed minutes to a step. */
export function addMinutes(p: ShopProgress, key: string, minutes: number): ShopProgress {
  return { ...p, minutes: { ...p.minutes, [key]: Math.round(((p.minutes[key] ?? 0) + minutes) * 10) / 10 } }
}

/** Opens Shop Mode for the design in the studio (generated steps, progress saved with the design). */
export function designSession(p: Project, save: (pr: ShopProgress) => void) {
  return { title: p.name, steps: stepsFromDesign(p), progress: p.shopProgress ?? emptyProgress(), kid: false, picture: true, save }
}
