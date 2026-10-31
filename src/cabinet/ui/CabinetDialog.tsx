// The door, drawer and face-frame makers, and the shelf-pin layout.
import { useState, type ReactNode } from 'react'
import type { Project } from '../../model/types'
import { formatInches } from '../../model/units'
import { InchInput } from '../../ui/designer/InchInput'
import { studio, useStudio } from '../../ui/store'
import { openingFrom, type Opening } from '../build'
import { addDoors, DOOR_DEFAULTS, type DoorOptions, type DoorStyle, type Mounting, type PullPlace } from '../doors'
import { addDrawer, DRAWER_DEFAULTS, type BoxJoint, type DrawerOptions, type SlideKind } from '../drawers'
import { addFaceFrame, FRAME_DEFAULTS, type FaceFrameOptions } from '../faceFrame'
import { addShelfPins, faceToward, faceTowardPoint, MM32, PIN_DEFAULTS, type PinOptions } from '../shelfPins'
import { worldBox } from '../../model/geometry'

const PULLS: [string, string][] = [['', 'None'], ['knob', 'Knob'], ['pull-3', 'Bar pull 3"'], ['pull-96', 'Bar pull 96 mm'], ['pull-128', 'Bar pull 128 mm'], ['pull-160', 'Bar pull 160 mm']]
const MOUNTINGS: [Mounting, string][] = [['full', 'Full overlay'], ['half', 'Half overlay'], ['inset', 'Inset']]

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-0.5 text-xs text-stone-600">{label}{children}</label>
}
function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange(v: T): void }) {
  return (
    <Field label={label}>
      <select aria-label={label} value={value} onChange={e => onChange(e.target.value as T)} className="rounded border border-stone-300 px-1 py-1 text-sm">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Field>
  )
}
function WoodSelect({ label, value, onChange, sheetsOnly }: { label: string; value: string; onChange(v: string): void; sheetsOnly?: boolean }) {
  const woods = useStudio(s => s.project.woods)
  return <Select label={label} value={value} onChange={onChange} options={woods.filter(w => !sheetsOnly || w.kind === 'sheet').map(w => [w.id, w.name] as [string, string])} />
}

function OpeningFields({ o, set, depth }: { o: Opening; set(o: Opening): void; depth?: boolean }) {
  const [msg, setMsg] = useState<string | null>(null)
  const take = () => {
    const s = studio.getState()
    const r = openingFrom(s.project, s.selection)
    if ('error' in r) return setMsg(r.error)
    setMsg(null)
    set(r)
  }
  return (
    <fieldset className="flex flex-col gap-2 rounded border border-stone-200 p-2">
      <legend className="px-1 text-xs font-semibold">The opening</legend>
      <button type="button" onClick={take} className="self-start rounded bg-sky-700 px-2 py-0.5 text-xs font-semibold text-white">Use the space between the selected parts</button>
      {msg && <p role="alert" className="text-xs text-red-700">{msg}</p>}
      <div className="grid grid-cols-3 gap-2">
        <InchInput label="Opening width" value={o.width} onChange={v => set({ ...o, width: v })} />
        <InchInput label="Opening height" value={o.height} onChange={v => set({ ...o, height: v })} />
        {depth && <InchInput label="Opening depth" value={o.depth ?? 0} onChange={v => set({ ...o, depth: v })} />}
        <InchInput label="Left (X)" allowZero value={o.x} onChange={v => set({ ...o, x: v })} />
        <InchInput label="Front (Y)" allowZero value={o.y} onChange={v => set({ ...o, y: v })} />
        <InchInput label="Bottom (Z)" allowZero value={o.z} onChange={v => set({ ...o, z: v })} />
      </div>
    </fieldset>
  )
}

/** Remembers the last opening between dialogs (and starts from the selection when there is one). */
let lastOpening: Opening = { x: 0, y: 0, z: 0, width: 15, height: 30, depth: 22 }
function startOpening(): Opening {
  const s = studio.getState()
  const r = s.selection.length >= 2 ? openingFrom(s.project, s.selection) : null
  return r && !('error' in r) ? r : lastOpening
}

function Shell({ title, onMake, children, error }: { title: string; onMake(): void; children: ReactNode; error: string | null }) {
  const close = () => studio.getState().setView({ cabinet: null })
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-6">
      <div role="dialog" aria-label={title} className="flex w-[560px] flex-col gap-3 rounded-xl bg-white p-4 shadow-xl">
        <h2 className="text-lg font-bold">{title}</h2>
        {children}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={close} className="rounded px-3 py-1 hover:bg-stone-100">Cancel</button>
          <button onClick={onMake} className="rounded bg-amber-700 px-4 py-1 font-semibold text-white">Make it</button>
        </div>
      </div>
    </div>
  )
}

function finish(r: { project: Project } | { error: string }, setError: (m: string) => void, o?: Opening) {
  if ('error' in r) return setError(r.error)
  if (o) lastOpening = o
  studio.getState().apply(() => r.project)
  studio.getState().setView({ cabinet: null })
}

function DoorMaker() {
  const [o, setO] = useState(startOpening)
  const [d, setD] = useState<DoorOptions>(DOOR_DEFAULTS)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<DoorOptions>) => setD(x => ({ ...x, ...patch }))
  const framed = d.style !== 'slab'
  return (
    <Shell title="Add a door" error={error} onMake={() => finish(addDoors(studio.getState().project, o, d), setError, o)}>
      <OpeningFields o={o} set={setO} />
      <div className="grid grid-cols-3 gap-2">
        <Select<DoorStyle> label="Style" value={d.style} onChange={style => set({ style, panelWood: style === 'raised' ? 'hw-4-4' : style === 'slab' ? 'ply-3-4' : 'ply-1-4' })} options={[['slab', 'Slab'], ['shaker', 'Shaker'], ['raised', 'Raised panel'], ['glass', 'Glass']]} />
        <Select<Mounting> label="Mounting" value={d.mounting} onChange={mounting => set({ mounting })} options={MOUNTINGS} />
        <Select label="Doors" value={d.pair ? 'pair' : 'one'} onChange={v => set({ pair: v === 'pair' })} options={[['one', 'One door'], ['pair', 'Two doors']]} />
        {!d.pair && <Select<'left' | 'right'> label="Hinges on the" value={d.hinge} onChange={hinge => set({ hinge })} options={[['left', 'Left'], ['right', 'Right']]} />}
        {framed && <InchInput label="Stile width" value={d.stile} onChange={stile => set({ stile })} />}
        {framed && <InchInput label="Rail width" value={d.rail} onChange={rail => set({ rail })} />}
        <WoodSelect label={framed ? 'Frame wood' : 'Wood'} value={framed ? d.frameWood : d.panelWood} onChange={v => set(framed ? { frameWood: v } : { panelWood: v })} />
        {(d.style === 'shaker' || d.style === 'raised') && <WoodSelect label="Panel wood" value={d.panelWood} onChange={panelWood => set({ panelWood })} />}
        <Select label="Pull" value={d.pull ?? ''} onChange={v => set({ pull: v || null })} options={PULLS} />
        {d.pull && <Select<PullPlace> label="Pull at" value={d.pullPlace} onChange={pullPlace => set({ pullPlace })} options={[['upper', 'Upper corner'], ['lower', 'Lower corner'], ['centre', 'Centred']]} />}
      </div>
      <p className="text-xs text-stone-500">Concealed 35 mm hinges: {d.mounting === 'inset' ? 'the door fits inside the opening with 1/16" all round' : `the door covers ${d.mounting === 'full' ? '1/2"' : '1/4"'} of the frame on every side`}.</p>
    </Shell>
  )
}

function DrawerMaker() {
  const [o, setO] = useState(startOpening)
  const [d, setD] = useState<DrawerOptions>(DRAWER_DEFAULTS)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<DrawerOptions>) => setD(x => ({ ...x, ...patch }))
  return (
    <Shell title="Add a drawer" error={error} onMake={() => finish(addDrawer(studio.getState().project, o, d), setError, o)}>
      <OpeningFields o={o} set={setO} depth />
      <div className="grid grid-cols-3 gap-2">
        <Select<SlideKind> label="Slides" value={d.slides} onChange={slides => set({ slides })} options={[['side', 'Side-mount ball-bearing'], ['under', 'Undermount'], ['runners', 'Wood runners']]} />
        <Select<BoxJoint> label="Box joints" value={d.joinery} onChange={joinery => set({ joinery })} options={[['butt', 'Butt (screws)'], ['rabbet', 'Rabbets'], ['dado', 'Dados'], ['dovetail', 'Dovetails']]} />
        <WoodSelect label="Box wood" value={d.boxWood} onChange={boxWood => set({ boxWood })} />
        <WoodSelect label="Bottom wood" value={d.bottomWood} onChange={bottomWood => set({ bottomWood })} sheetsOnly />
        <Select<Mounting | 'none'> label="Drawer face" value={d.front} onChange={front => set({ front })} options={[...MOUNTINGS, ['none', 'None']]} />
        {d.front !== 'none' && <WoodSelect label="Face wood" value={d.frontWood} onChange={frontWood => set({ frontWood })} />}
        <Select label="Pull" value={d.pull ?? ''} onChange={v => set({ pull: v || null })} options={PULLS} />
      </div>
      <p className="text-xs text-stone-500">Check your slide maker&apos;s instructions — sizes vary.</p>
    </Shell>
  )
}

function FrameMaker() {
  const [o, setO] = useState<Opening>(() => ({ ...startOpening(), width: 36, height: 30 }))
  const [f, setF] = useState<FaceFrameOptions>(FRAME_DEFAULTS)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<FaceFrameOptions>) => setF(x => ({ ...x, ...patch }))
  const n = (label: string, v: number, k: 'midStiles' | 'midRails') => (
    <Field label={label}><input aria-label={label} type="number" min={0} max={8} value={v} onChange={e => set({ [k]: Math.max(0, Math.min(8, Math.round(Number(e.target.value) || 0))) })} className="rounded border border-stone-300 px-1 py-1 text-sm" /></Field>
  )
  return (
    <Shell title="Add a face frame" error={error} onMake={() => finish(addFaceFrame(studio.getState().project, o, f), setError)}>
      <p className="text-xs text-stone-500">The frame&apos;s outside size, and where its lower-left-front corner goes.</p>
      <OpeningFields o={o} set={setO} />
      <div className="grid grid-cols-3 gap-2">
        <InchInput label="Stile width" value={f.stile} onChange={stile => set({ stile })} />
        <InchInput label="Top rail" value={f.topRail} onChange={topRail => set({ topRail })} />
        <InchInput label="Bottom rail" value={f.bottomRail} onChange={bottomRail => set({ bottomRail })} />
        {n('Mid stiles', f.midStiles, 'midStiles')}
        {n('Mid rails', f.midRails, 'midRails')}
        <Select<'pocketScrew' | 'butt'> label="Joints" value={f.joinery} onChange={joinery => set({ joinery })} options={[['pocketScrew', 'Pocket screws'], ['butt', 'Butt (glue)']]} />
        <WoodSelect label="Wood" value={f.wood} onChange={wood => set({ wood })} />
      </div>
    </Shell>
  )
}

function PinMaker() {
  const selection = useStudio(s => s.selection)
  const [o, setO] = useState<Omit<PinOptions, 'face'>>(PIN_DEFAULTS)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof o>) => setO(x => ({ ...x, ...patch }))
  const make = () => {
    let p = studio.getState().project
    const sides = p.boards.filter(b => selection.includes(b.id))
    if (sides.length < 1 || sides.length > 2) return setError('Select one cabinet side, or the two sides facing each other')
    // The holes go in the faces that look inward: toward the other side, or the rest of the design.
    // With one side, the holes face the middle of the design (or of the rest of it).
    const rest = p.boards.filter(b => !selection.includes(b.id))
    const centre = (bs: typeof rest) => { const bx = bs.map(worldBox); return { x: (Math.min(...bx.map(q => q.min.x)) + Math.max(...bx.map(q => q.max.x))) / 2, y: (Math.min(...bx.map(q => q.min.y)) + Math.max(...bx.map(q => q.max.y))) / 2, z: (Math.min(...bx.map(q => q.min.z)) + Math.max(...bx.map(q => q.max.z))) / 2 } }
    for (const [i, b] of sides.entries()) {
      const other = sides[1 - i]
      const face = other ? faceToward(b, other) : rest.length ? faceTowardPoint(b, centre(rest)) : 'top'
      const r = addShelfPins(p, b.id, { ...o, face, shelves: i === 0 ? o.shelves : 0 })
      if ('error' in r) return setError(r.error)
      p = r
    }
    finish({ project: p }, setError)
  }
  return (
    <Shell title="Shelf pins" error={error} onMake={make}>
      <p className="text-xs text-stone-500">{selection.length === 2 ? 'Both selected sides get the same layout, on the faces that look at each other.' : 'Holes go in the face that looks into the cabinet. Select both sides to do them together.'}</p>
      <div className="grid grid-cols-3 gap-2">
        <Select<PinOptions['size']> label="Pin size" value={o.size} onChange={size => set({ size })} options={[['5mm', '5 mm'], ['1/4', '1/4"']]} />
        <InchInput label="Hole depth" value={o.depth} onChange={depth => set({ depth })} />
        <Select label="Spacing" value={Math.abs(o.spacing - MM32) < 1e-9 ? '32' : '1'} onChange={v => set({ spacing: v === '32' ? MM32 : 1 })} options={[['32', '32 mm'], ['1', '1"']]} />
        <InchInput label="Row in from the front" value={o.front} onChange={front => set({ front })} />
        <InchInput label="Row in from the back" value={o.back} onChange={back => set({ back })} />
        <Field label="Shelves on pins"><input aria-label="Shelves on pins" type="number" min={0} max={20} value={o.shelves} onChange={e => set({ shelves: Math.max(0, Math.round(Number(e.target.value) || 0)) })} className="rounded border border-stone-300 px-1 py-1 text-sm" /></Field>
        <InchInput label="Start above the bottom" allowZero value={o.from} onChange={from => set({ from })} />
        <InchInput label="Stop below the top" allowZero value={o.to} onChange={to => set({ to })} />
      </div>
      <p className="text-xs text-stone-500">{`Holes ${formatInches(o.depth)} deep.`}</p>
    </Shell>
  )
}

export function CabinetDialog() {
  const which = useStudio(s => s.cabinet)
  if (which === 'door') return <DoorMaker />
  if (which === 'drawer') return <DrawerMaker />
  if (which === 'frame') return <FrameMaker />
  if (which === 'pins') return <PinMaker />
  return null
}
