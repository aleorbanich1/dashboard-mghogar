import Calculadora from './pages/Calculadora'
import Login from './pages/Login'
import { useSession } from './lib/auth'

function App() {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
        Cargando…
      </div>
    )
  }

  if (!session) return <Login />

  return <Calculadora />
}

export default App
