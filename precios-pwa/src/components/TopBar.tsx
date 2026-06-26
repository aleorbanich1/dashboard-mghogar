import ThemeToggle from './ThemeToggle'
import { signOut } from '../lib/auth'

export type Tab = 'precios' | 'clientes'

const TABS: { id: Tab; label: string }[] = [
  { id: 'precios', label: 'Precios diferenciales' },
  { id: 'clientes', label: 'Clientes' },
]

export default function TopBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-slate-50/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto max-w-md px-5 pt-[calc(env(safe-area-inset-top)+0.6rem)]">
        <div className="flex items-center justify-between gap-3 pb-2.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Panel
          </span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => signOut()}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="flex h-11 items-center rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 transition active:scale-95 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Salir
            </button>
          </div>
        </div>

        <nav
          role="tablist"
          aria-label="Secciones"
          className="mb-3 flex gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/60"
        >
          {TABS.map((t) => {
            const active = t.id === tab
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => onTab(t.id)}
                className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-2 text-sm font-semibold transition active:scale-[0.98] ${
                  active
                    ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
