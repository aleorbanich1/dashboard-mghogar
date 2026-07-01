import { useState } from 'react'
import Calculadora from './pages/Calculadora'
import Clientes from './pages/Clientes'
import Login from './pages/Login'
import Register from './pages/Register'
import TopBar, { type Tab } from './components/TopBar'
import { useSession } from './lib/auth'

function App() {
  const { session, loading } = useSession()
  const [tab, setTab] = useState<Tab>('precios')
  const [authView, setAuthView] = useState<'login' | 'register'>('login')

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
        Cargando…
      </div>
    )
  }

  if (!session) {
    return authView === 'login' ? (
      <Login onRegister={() => setAuthView('register')} />
    ) : (
      <Register onBack={() => setAuthView('login')} />
    )
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950">
      <TopBar tab={tab} onTab={setTab} />
      {tab === 'precios' ? <Calculadora /> : <Clientes />}
    </div>
  )
}

export default App
