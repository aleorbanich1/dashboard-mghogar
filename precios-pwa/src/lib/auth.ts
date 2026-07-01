import { useEffect, useState } from 'react'

export interface Usuario {
  id: string
  nombre: string
  rol: string
}

export function useSession() {
  const [session, setSession] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    function load() {
      const stored = localStorage.getItem('usuario_sesion')
      if (stored) {
        try {
          setSession(JSON.parse(stored))
        } catch (err) {
          localStorage.removeItem('usuario_sesion')
          setSession(null)
        }
      } else {
        setSession(null)
      }
      setLoading(false)
    }

    load()
    window.addEventListener('session_changed', load)
    return () => window.removeEventListener('session_changed', load)
  }, [])

  return { session, loading }
}

export function setLocalSession(user: Usuario) {
  localStorage.setItem('usuario_sesion', JSON.stringify(user))
  window.dispatchEvent(new Event('session_changed'))
}

export function signOut() {
  localStorage.removeItem('usuario_sesion')
  window.location.reload()
}
