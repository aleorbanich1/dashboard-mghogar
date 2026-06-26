import { useEffect, useMemo, useState } from 'react'
import {
  VISIT_TYPES,
  TONE_COLOR,
  type VisitTypeId,
  type VisitType,
} from '../data/clientes'
import {
  loadRegistros,
  addRegistro,
  loadAllCategories,
  addCategory,
  type Registro,
} from '../lib/registros'
import { BarChart, type BarDatum } from '../components/charts'

type Periodo = 'semana' | 'todo'

function inicioSemana(now = new Date()): number {
  // Semana ISO: arranca lunes 00:00 local.
  const d = new Date(now)
  const dia = (d.getDay() + 6) % 7 // 0 = lunes
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - dia)
  return d.getTime()
}

export default function Clientes() {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [categorias, setCategorias] = useState<string[]>([])

  // Selección en curso del empleado.
  const [visit, setVisit] = useState<VisitTypeId | null>(null)
  const [demand, setDemand] = useState<string | null>(null)
  const [nuevaCat, setNuevaCat] = useState('')
  const [guardado, setGuardado] = useState(false)

  const [periodo, setPeriodo] = useState<Periodo>('semana')

  useEffect(() => {
    loadRegistros().then(setRegistros)
    loadAllCategories().then(setCategorias)
  }, [])

  async function registrar() {
    if (!visit) return
    const next = await addRegistro({ visit, demand })
    setRegistros(next)
    setVisit(null)
    setDemand(null)
    setGuardado(true)
    window.setTimeout(() => setGuardado(false), 2200)
  }

  async function agregarCategoria() {
    const name = nuevaCat.trim()
    if (!name) return
    const next = await addCategory(name)
    setCategorias(next)
    setNuevaCat('')
    // Deja seleccionada la recién creada para registrarla al toque.
    setDemand(next.find((c) => c.toLowerCase() === name.toLowerCase()) ?? null)
  }

  const filtrados = useMemo(() => {
    if (periodo === 'todo') return registros
    const desde = inicioSemana()
    return registros.filter((r) => r.ts >= desde)
  }, [registros, periodo])

  return (
    <main className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex max-w-md flex-col gap-8 px-5 pb-12 pt-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Registrá cada persona que entra. Misma opción para todos: así los números cierran.
          </p>
        </header>

        {/* PASO 1 — Qué hizo la persona */}
        <section className="flex flex-col gap-3">
          <SectionTitle paso="1" title="¿Qué hizo la persona?" />
          <div className="flex flex-col gap-3">
            {VISIT_TYPES.map((v) => (
              <VisitButton
                key={v.id}
                visit={v}
                selected={visit === v.id}
                onSelect={() => setVisit(visit === v.id ? null : v.id)}
              />
            ))}
          </div>
        </section>

        {/* PASO 2 — Demanda no cubierta */}
        <section className="flex flex-col gap-3 border-t border-slate-200 pt-7 dark:border-slate-800">
          <SectionTitle
            paso="2"
            title="¿Pidió algo que no tenemos?"
            hint="Opcional. Elegí la categoría del producto que pidió."
          />
          <div className="grid grid-cols-2 gap-3">
            {categorias.map((c) => {
              const active = demand === c
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDemand(active ? null : c)}
                  className={`flex min-h-[60px] items-center justify-center rounded-2xl border px-3 text-center text-base font-semibold transition active:scale-[0.98] ${
                    active
                      ? 'border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-500 dark:text-slate-950'
                      : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                  }`}
                >
                  {c}
                </button>
              )
            })}
          </div>

          {/* Caja para sumar categorías al catálogo único */}
          <div className="mt-2 flex flex-col gap-2">
            <label
              htmlFor="nueva-categoria"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Agregar categoría de producto
            </label>
            <div className="flex gap-2">
              <input
                id="nueva-categoria"
                value={nuevaCat}
                autoComplete="off"
                placeholder="Ej: Aire acondicionado"
                onChange={(e) => setNuevaCat(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    agregarCategoria()
                  }
                }}
                className="min-h-[52px] flex-1 rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/25"
              />
              <button
                type="button"
                onClick={agregarCategoria}
                disabled={!nuevaCat.trim()}
                className="min-h-[52px] shrink-0 rounded-xl bg-emerald-600 px-5 text-base font-semibold text-white transition active:scale-[0.97] disabled:opacity-40 dark:bg-emerald-500 dark:text-slate-950"
              >
                Agregar
              </button>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Se carga una sola vez y queda disponible para todos.
            </span>
          </div>
        </section>

        {/* Registrar */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={registrar}
            disabled={!visit}
            className="min-h-[56px] w-full rounded-2xl bg-emerald-600 text-base font-bold text-white transition active:scale-[0.98] disabled:opacity-40 dark:bg-emerald-500 dark:text-slate-950"
          >
            Registrar visita
          </button>
          <p
            aria-live="polite"
            className={`text-center text-sm font-medium text-emerald-700 transition-opacity dark:text-emerald-400 ${
              guardado ? 'opacity-100' : 'opacity-0'
            }`}
          >
            Visita registrada.
          </p>
        </div>

        {/* Gráficos */}
        <section className="flex flex-col gap-6 border-t border-slate-200 pt-7 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Estadísticas
            </h2>
            <PeriodoToggle value={periodo} onChange={setPeriodo} />
          </div>

          <Resumen registros={filtrados} />

          <ChartCard title="Embudo de visitas">
            <BarChart
              data={dataVisitas(filtrados)}
              unit="pers."
              emptyHint="Registrá visitas para ver el embudo."
            />
          </ChartCard>

          <ChartCard
            title="Productos más pedidos"
            subtitle="Categorías que la gente pide y no tenés en stock."
          >
            <BarChart
              data={dataDemanda(filtrados)}
              unit="ped."
              emptyHint="Nadie pidió productos sin stock todavía."
            />
          </ChartCard>
        </section>
      </div>
    </main>
  )
}

/* ---------- Cálculo de datos para gráficos ---------- */

function dataVisitas(registros: Registro[]): BarDatum[] {
  return VISIT_TYPES.map((v) => ({
    label: v.label,
    value: registros.filter((r) => r.visit === v.id).length,
    color: TONE_COLOR[v.tone],
  }))
}

function dataDemanda(registros: Registro[]): BarDatum[] {
  const cuenta = new Map<string, number>()
  for (const r of registros) {
    if (!r.demand) continue
    cuenta.set(r.demand, (cuenta.get(r.demand) ?? 0) + 1)
  }
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, color: TONE_COLOR.busca }))
}

/* ---------- Subcomponentes ---------- */

function Resumen({ registros }: { registros: Registro[] }) {
  const total = registros.length
  const compraron = registros.filter((r) => r.visit === 'pregunto_compro').length
  const conversion = total > 0 ? Math.round((compraron / total) * 100) : 0

  return (
    <div className="grid grid-cols-3 gap-3">
      <Stat label="Entraron" value={total} />
      <Stat label="Compraron" value={compraron} accent />
      <Stat label="Conversión" value={`${conversion}%`} accent />
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: number | string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-4 dark:border-slate-800 dark:bg-slate-900">
      <span
        className={`text-2xl font-extrabold tabular-nums tracking-tight ${
          accent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-50'
        }`}
      >
        {value}
      </span>
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  )
}

function PeriodoToggle({
  value,
  onChange,
}: {
  value: Periodo
  onChange: (p: Periodo) => void
}) {
  const opciones: { id: Periodo; label: string }[] = [
    { id: 'semana', label: 'Semana' },
    { id: 'todo', label: 'Todo' },
  ]
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60">
      {opciones.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.id)}
            className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold transition ${
              active
                ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 border-t border-slate-100 pt-5 dark:border-slate-800/70">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function SectionTitle({
  paso,
  title,
  hint,
}: {
  paso: string
  title: string
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white dark:bg-emerald-500 dark:text-slate-950">
          {paso}
        </span>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">{title}</h2>
      </div>
      {hint && <p className="pl-8 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  )
}

function VisitButton({
  visit,
  selected,
  onSelect,
}: {
  visit: VisitType
  selected: boolean
  onSelect: () => void
}) {
  const color = TONE_COLOR[visit.tone]
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      style={selected ? { backgroundColor: color, borderColor: color } : { borderLeftColor: color }}
      className={`flex min-h-[68px] w-full items-center gap-3 rounded-2xl border border-l-4 px-4 text-left text-lg font-semibold transition active:scale-[0.98] ${
        selected
          ? 'text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
      }`}
    >
      <span className="flex-1">{visit.label}</span>
      {selected && <CheckIcon />}
    </button>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
