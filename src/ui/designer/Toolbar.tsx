import { useState } from 'react'
import { worldBox } from '../../model/geometry'
import { addBoard, alignBoards, deleteBoards, duplicateBoards, mirrorBoards, rotateBoard } from '../../model/ops'
import { plans } from '../../plans/plansStore'
import { TEMPLATES } from '../../templates'
import { studio, useStudio, type View } from '../store'

function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  const { active, className, ...rest } = props
  return (
    <button
      {...rest}
      className={`rounded px-2 py-1 text-sm disabled:opacity-40 ${active ? 'bg-amber-700 text-white' : 'hover:bg-stone-200'} ${className ?? ''}`}
    />
  )
}

function Menu({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <Btn onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}>{label} ▾</Btn>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-20 flex min-w-40 flex-col rounded border border-stone-300 bg-white py-1 shadow-lg">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

const item = 'px-3 py-1 text-left text-sm hover:bg-amber-100'

export function Toolbar() {
  const selection = useStudio(s => s.selection)
  const view = useStudio(s => s.view)
  const measuring = useStudio(s => s.measuring)
  const canUndo = useStudio(s => s.canUndo)
  const canRedo = useStudio(s => s.canRedo)
  const kidsMode = useStudio(s => s.kidsMode)
  const s = studio.getState()
  const sel = selection.length > 0

  const add = () =>
    s.apply(p => {
      const right = p.boards.length ? Math.max(...p.boards.map(b => worldBox(b).max.x)) + 1 : 0
      const r = addBoard(p, { woodId: p.woods.some(w => w.id === '1x4') ? '1x4' : p.woods[0].id, name: `Board ${p.boards.length + 1}`, position: { x: right, y: 0, z: 0 } })
      setTimeout(() => s.select([r.id]))
      return r.project
    })

  const views: [View, string][] = [['3d', '3D'], ['front', 'Front'], ['side', 'Side'], ['top', 'Top']]

  return (
    <nav aria-label="Toolbar" className="flex flex-wrap items-center gap-1 border-b border-stone-300 bg-white px-2 py-1">
      {kidsMode ? (
        <>
          <Btn onClick={() => s.goto('kids')} title="Back to the Kids' Workshop">⌂ Kids&apos; Workshop</Btn>
          <span className="px-2 text-sm font-bold text-violet-700">Simple Designer</span>
        </>
      ) : (
        <Btn onClick={() => s.goto('home')} title="Home">⌂ Home</Btn>
      )}
      <span className="mx-1 h-5 w-px bg-stone-300" />
      {kidsMode ? <Btn onClick={() => s.newBlank()}>New</Btn> : <Menu label="New">
        {close => (
          <>
            {TEMPLATES.map(t => (
              <button key={t.id} role="menuitem" className={item} onClick={() => { s.newFromTemplate(t.id); close() }}>{t.name}</button>
            ))}
            <button role="menuitem" className={item} onClick={() => { s.newBlank(); close() }}>Blank project</button>
          </>
        )}
      </Menu>}
      <Btn onClick={() => void s.open()}>Open</Btn>
      <Btn onClick={() => void s.save()}>Save</Btn>
      <Btn onClick={() => void s.saveAs()}>Save As</Btn>
      <span className="mx-1 h-5 w-px bg-stone-300" />
      <Btn onClick={add}>Add board</Btn>
      <Btn disabled={!sel} onClick={() => { let ids: string[] = []; s.apply(p => { const r = duplicateBoards(p, selection); ids = r.ids; return r.project }); s.select(ids) }}>Duplicate</Btn>
      {!kidsMode && <Menu label="Mirror">
        {close => (['x', 'y', 'z'] as const).map(ax => (
          <button key={ax} role="menuitem" disabled={!sel} className={item} onClick={() => { s.apply(p => mirrorBoards(p, selection, ax)); close() }}>
            Mirror across {ax.toUpperCase()}
          </button>
        ))}
      </Menu>}
      {!kidsMode && <Menu label="Align">
        {close => (['x', 'y', 'z'] as const).flatMap(ax => (['min', 'center', 'max'] as const).map(m => (
          <button key={ax + m} role="menuitem" disabled={selection.length < 2} className={item} onClick={() => { s.apply(p => alignBoards(p, selection, ax, m)); close() }}>
            {ax.toUpperCase()} {m === 'min' ? 'low side' : m === 'max' ? 'high side' : 'center'}
          </button>
        )))}
      </Menu>}
      <Menu label="Rotate 90°">
        {close => (['x', 'y', 'z'] as const).map(ax => (
          <button key={ax} role="menuitem" disabled={!sel} className={item} onClick={() => { s.apply(p => selection.reduce((q, id) => rotateBoard(q, id, ax, 90), p)); close() }}>
            About {ax.toUpperCase()}
          </button>
        ))}
      </Menu>
      <Btn disabled={!sel} onClick={() => { s.apply(p => deleteBoards(p, selection)); s.select([]) }}>Delete</Btn>
      <span className="mx-1 h-5 w-px bg-stone-300" />
      <Btn disabled={!canUndo} onClick={() => s.undo()} title="Ctrl+Z">Undo</Btn>
      <Btn disabled={!canRedo} onClick={() => s.redo()} title="Ctrl+Y">Redo</Btn>
      <span className="mx-1 h-5 w-px bg-stone-300" />
      {!kidsMode && <Btn active={measuring} onClick={() => s.set({ measuring: !measuring })}>Measure</Btn>}
      {views.map(([v, label]) => (
        <Btn key={v} active={view === v} onClick={() => s.set({ view: v })}>{label}</Btn>
      ))}
      <Btn onClick={() => window.dispatchEvent(new Event('aa:zoom-fit'))}>Fit</Btn>
      <span className="mx-1 h-5 w-px bg-stone-300" />
      {!kidsMode && <Btn onClick={() => s.set({ woodsOpen: true })}>Woods</Btn>}
      <Btn className="bg-amber-100 font-semibold" onClick={() => s.set({ cutListOpen: true })}>Cut List</Btn>
      {!kidsMode && (
        <Btn className="font-semibold" onClick={() => { s.goto('plans'); void plans.getState().openLibrary(false, () => s.goto('master')) }}>📋 My Plans</Btn>
      )}
    </nav>
  )
}
