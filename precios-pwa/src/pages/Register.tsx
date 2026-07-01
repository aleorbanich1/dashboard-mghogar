import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { setLocalSession } from '../lib/auth'

interface Props {
  onBack: () => void
}

export default function Register({ onBack }: Props) {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = usuario.trim()
    if (!trimmed) {
      setError('Ingresá un nombre de usuario.')
      return
    }
    if (/\s/.test(trimmed)) {
      setError('El usuario no puede tener espacios.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.')
      return
    }

    setCargando(true)

    try {
      const { data, error } = await supabase.rpc('registrar_usuario', {
        p_nombre: trimmed,
        p_password: password,
      })
      if (error) throw error
      if (!data) throw new Error('Error al crear la cuenta.')

      setLocalSession(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error desconocido',
      )
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold mb-1">Crear cuenta</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          Calculadora de precios
        </p>

        <label className="block text-sm font-medium mb-1" htmlFor="reg-usuario">
          Usuario
        </label>
        <input
          id="reg-usuario"
          type="text"
          required
          autoComplete="username"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="ej: juan"
          className="w-full mb-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        />

        <label className="block text-sm font-medium mb-1" htmlFor="reg-password">
          Contraseña
        </label>
        <input
          id="reg-password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        />

        <label
          className="block text-sm font-medium mb-1"
          htmlFor="reg-confirm-password"
        >
          Confirmar contraseña
        </label>
        <input
          id="reg-confirm-password"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full mb-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        />

        {error && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2 transition-colors"
        >
          {cargando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="w-full mt-3 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Ya tengo cuenta — Iniciar sesión
        </button>
      </form>
    </div>
  )
}
