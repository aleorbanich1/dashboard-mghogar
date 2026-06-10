import { useCallback, useEffect, useState } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'
const LIGHT_COLOR = '#059669' // emerald-600
const DARK_COLOR = '#0b1120'

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* storage no disponible */
  }
  return 'system'
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

function resolve(pref: ThemePref): boolean {
  return pref === 'system' ? systemPrefersDark() : pref === 'dark'
}

/** Aplica la clase al <html> y actualiza theme-color. Idempotente. */
function applyTheme(isDark: boolean) {
  const root = document.documentElement
  root.classList.toggle('dark', isDark)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', isDark ? DARK_COLOR : LIGHT_COLOR)
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readPref)
  const [isDark, setIsDark] = useState<boolean>(() => resolve(readPref()))

  // Aplica preferencia.
  useEffect(() => {
    const dark = resolve(pref)
    setIsDark(dark)
    applyTheme(dark)
    try {
      if (pref === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, pref)
    } catch {
      /* ignore */
    }
  }, [pref])

  // Sigue al sistema en tiempo real cuando pref === 'system'.
  useEffect(() => {
    if (pref !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const dark = mq.matches
      setIsDark(dark)
      applyTheme(dark)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])

  // Cicla: system -> light -> dark -> system.
  const cycle = useCallback(() => {
    setPref((p) => (p === 'system' ? 'light' : p === 'light' ? 'dark' : 'system'))
  }, [])

  return { pref, isDark, setPref, cycle }
}
