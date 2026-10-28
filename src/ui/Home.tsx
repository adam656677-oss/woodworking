import { studio } from './store'

export function Home() {
  const enterMaster = async () => {
    const s = studio.getState()
    s.goto('master')
    await s.checkUntitledAutosave()
  }
  return (
    <main className="flex h-full flex-col items-center justify-center gap-10 bg-gradient-to-b from-amber-50 to-stone-200">
      <header className="text-center">
        <h1 className="text-4xl font-bold text-stone-800">A&amp;A Woodworking Studio</h1>
        <p className="mt-2 text-stone-600">Design it together. Build it together.</p>
      </header>
      <div className="flex gap-8">
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
      </div>
    </main>
  )
}
