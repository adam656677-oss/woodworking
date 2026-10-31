import { useEffect } from 'react'
import { lowStock, tools, useTools } from '../tools/store'
import { openShopTools } from '../tools/ui/ShopTools'
import { openFinishing } from '../finish/ui/FinishingSchool'
import { studio } from './store'
import { BackupBar } from '../family/ui/BackupBar'
import { openHelper } from '../smart/ui/SmartDialogs'

export function Home() {
  const inv = useTools(s => s.inventory)
  useEffect(() => { if (!tools.getState().loaded) void tools.getState().load() }, [])
  const low = lowStock(inv)
  const enterMaster = async () => {
    const s = studio.getState()
    s.enterMasterShop()
    await s.checkUntitledAutosave()
  }
  return (
    <main className="flex h-full flex-col items-center justify-center gap-10 bg-gradient-to-b from-amber-50 to-stone-200">
      <header className="text-center">
        <h1 className="text-4xl font-bold text-stone-800">A&amp;A Woodworking Studio</h1>
        <p className="mt-2 text-stone-600">Design it together. Build it together.</p>
      </header>
      <div className="grid grid-cols-2 gap-8 xl:grid-cols-4">
        <button
          onClick={() => studio.getState().goto('kids')}
          className="flex h-56 w-72 flex-col items-center justify-center gap-3 rounded-2xl border-4 border-sky-400 bg-sky-100 text-sky-900 shadow-lg hover:bg-sky-200"
        >
          <span className="text-5xl" aria-hidden>🔨</span>
          <span className="text-2xl font-bold">Kids&apos; Workshop</span>
        </button>
        <button
          onClick={enterMaster}
          className="flex h-56 w-72 flex-col items-center justify-center gap-3 rounded-2xl border-4 border-amber-700 bg-amber-100 text-amber-950 shadow-lg hover:bg-amber-200"
        >
          <span className="text-5xl" aria-hidden>📐</span>
          <span className="text-2xl font-bold">Master Shop</span>
        </button>
        <button
          onClick={() => openFinishing('home')}
          className="flex h-56 w-72 flex-col items-center justify-center gap-3 rounded-2xl border-4 border-emerald-700 bg-emerald-50 text-emerald-950 shadow-lg hover:bg-emerald-100"
        >
          <span className="text-5xl" aria-hidden>🖌️</span>
          <span className="text-2xl font-bold">Finishing School</span>
        </button>
        <button
          onClick={() => openShopTools('home')}
          className="flex h-56 w-72 flex-col items-center justify-center gap-3 rounded-2xl border-4 border-stone-600 bg-stone-100 text-stone-900 shadow-lg hover:bg-stone-200"
        >
          <span className="text-5xl" aria-hidden>🧮</span>
          <span className="text-2xl font-bold">Shop Tools</span>
        </button>
      </div>
      <BackupBar />
      <button onClick={() => openHelper('settings')} className="text-sm text-stone-600 underline">✨ Smart Helpers settings</button>
      {low.length > 0 && (
        <p role="alert" className="rounded-xl bg-amber-100 px-4 py-2 text-amber-900">
          Running low: {low.join('; ')} — <button className="underline" onClick={() => openShopTools('home', 'inventory')}>see the inventory</button>
        </p>
      )}
    </main>
  )
}
