import { useState } from 'react'
import ThemeToggle from './ThemeToggle'
import { signOut } from '../lib/auth'

export type Tab = 'precios' | 'clientes' | 'registro'

// El día de la fusión se agrega acá la cuarta opción: Tareas.
const ITEMS: { id: Tab; label: string; icono: React.ReactNode }[] = [
  {
    id: 'precios',
    label: 'Calculadora de Precios',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path strokeLinecap="round" d="M9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" />
      </svg>
    ),
  },
  {
    id: 'clientes',
    label: 'Clientes',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <circle cx="9" cy="8" r="3.5" />
        <path strokeLinecap="round" d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5a3.5 3.5 0 0 1 0 7M20.5 20a5.5 5.5 0 0 0-4-5.3" />
      </svg>
    ),
  },
  {
    id: 'registro',
    label: 'Registro de llegada',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5V12l3 2" />
      </svg>
    ),
  },
]

function NavItems({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Secciones">
      {ITEMS.map((item) => {
        const activo = item.id === tab
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTab(item.id)}
            aria-current={activo ? 'page' : undefined}
            className={`flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-sm font-semibold transition active:scale-[0.98] ${
              activo
                ? 'bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {item.icono}
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

function PieAcciones() {
  return (
    <div className="flex items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
      <ThemeToggle />
      <button
        type="button"
        onClick={() => signOut()}
        className="flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 transition active:scale-95 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Cerrar sesión
      </button>
    </div>
  )
}

export default function Sidebar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const [abierta, setAbierta] = useState(false)

  function elegir(t: Tab) {
    onTab(t)
    setAbierta(false)
  }

  return (
    <>
      {/* Barra superior (solo mobile): hamburguesa + título de la sección */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-slate-50/85 backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-slate-950/85">
        <div className="flex items-center gap-3 px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.6rem)]">
          <button
            type="button"
            onClick={() => setAbierta(true)}
            aria-label="Abrir menú"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition active:scale-95 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="text-sm font-semibold">
            {ITEMS.find((i) => i.id === tab)?.label}
          </span>
        </div>
      </header>

      {/* Drawer mobile */}
      {abierta && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setAbierta(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white p-4 pt-[calc(env(safe-area-inset-top)+1rem)] shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2.5">
              <img src="/logo-mghogar.png" alt="" className="h-9 w-9 rounded-xl object-contain" />
              <div>
                <p className="text-sm font-bold leading-tight">MG Hogar</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">Panel</p>
              </div>
            </div>
            <div className="flex-1">
              <NavItems tab={tab} onTab={elegir} />
            </div>
            <PieAcciones />
          </aside>
        </div>
      )}

      {/* Sidebar fija (desktop) */}
      <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 lg:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-2.5">
          <img src="/logo-mghogar.png" alt="" className="h-10 w-10 rounded-xl object-contain" />
          <div>
            <p className="text-sm font-bold leading-tight">MG Hogar</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Panel</p>
          </div>
        </div>
        <div className="flex-1">
          <NavItems tab={tab} onTab={onTab} />
        </div>
        <PieAcciones />
      </aside>
    </>
  )
}
