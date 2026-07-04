import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Atrapa cualquier error de render de React y muestra una pantalla amable en vez
 * de la pantalla azul en blanco. Los datos ya guardados en Supabase no se tocan.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error atrapado por ErrorBoundary:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-6 text-center dark:bg-slate-950">
        <div className="flex max-w-sm flex-col items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Hubo un error</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tus datos están guardados. Recargá la página para seguir.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-[52px] w-full rounded-xl bg-emerald-600 text-base font-bold text-white transition active:scale-[0.98] dark:bg-emerald-500 dark:text-slate-950"
          >
            Recargar la página
          </button>
        </div>
      </div>
    )
  }
}
