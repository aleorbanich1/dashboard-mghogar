import { useState } from 'react'
import Calculadora from './pages/Calculadora'
import Clientes from './pages/Clientes'
import Asistencia from './pages/Asistencia'
import Calendarios from './pages/Calendarios'
import Login from './pages/Login'
import Sidebar, { type Tab } from './components/Sidebar'
import { useSession } from './lib/auth'

function App() {
  const { session, loading } = useSession()
  const [tab, setTab] = useState<Tab>('precios')

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
        Cargando…
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 lg:flex">
      <Sidebar tab={tab} onTab={setTab} />
      <div className="min-w-0 flex-1">
        {tab === 'precios' ? (
          <Calculadora />
        ) : tab === 'clientes' ? (
          <Clientes />
        ) : tab === 'registro' ? (
          <Asistencia />
        ) : (
          <Calendarios />
        )}
      </div>
    </div>
  )
}

export default App
