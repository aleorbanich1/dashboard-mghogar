import type { ReactNode } from 'react'
import { useTheme, type ThemePref } from '../lib/theme'

/** Botón de tema reutilizable (system → light → dark). Sin emojis, trazo 1.5. */
export default function ThemeToggle() {
  const { pref, cycle } = useTheme()

  const meta: Record<ThemePref, { label: string; icon: ReactNode }> = {
    system: { label: 'Tema automático', icon: <MonitorIcon /> },
    light: { label: 'Tema claro', icon: <SunIcon /> },
    dark: { label: 'Tema oscuro', icon: <MoonIcon /> },
  }
  const current = meta[pref]

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${current.label}. Tocar para cambiar.`}
      title={current.label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition active:scale-95 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:active:bg-slate-800"
    >
      {current.icon}
    </button>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}
