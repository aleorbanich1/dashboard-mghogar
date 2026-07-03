import { useEffect, useMemo, useState } from 'react'
import {
  VISIT_TYPES,
  TONE_COLOR,
  CUSTOM_VISIT_COLOR,
  EMPLEADO_COLOR,
} from '../data/clientes'
import {
  loadRegistros,
  addRegistro,
  loadAllCategories,
  addCategory,
  loadEmpleados,
  loadCustomVisitTypes,
  addVisitType,
  type Registro,
  type Empleado,
} from '../lib/registros'
import { BarChart, type BarDatum } from '../components/charts'

/* ---------- Helpers de fechas (para el rango) ---------- */

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function lunesDeEstaSemana(): string {
  const d = new Date()
  const dia = (d.getDay() + 6) % 7 // 0 = lunes
  d.setDate(d.getDate() - dia)
  return toISODate(d)
}

/** Opción de visita: id fijo o nombre de tipo personalizado. */
interface VisitOption {
  value: string
  label: string
  color: string
}

export default function Clientes() {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [customTypes, setCustomTypes] = useState<string[]>([])

  // Selección en curso del empleado.
  const [visit, setVisit] = useState<string | null>(null)
  const [demand, setDemand] = useState<string | null>(null)
  // Empleado que atendió; lo elige el admin en cada registro (arranca sin asignar).
  const [empleadoId, setEmpleadoId] = useState<string | null>(null)
  const [nuevaCat, setNuevaCat] = useState('')
  const [nuevoTipo, setNuevoTipo] = useState('')
  const [guardado, setGuardado] = useState(false)

  // Rango de fechas para las estadísticas.
  const [desde, setDesde] = useState<string>(lunesDeEstaSemana())
  const [hasta, setHasta] = useState<string>(toISODate(new Date()))

  useEffect(() => {
    loadRegistros().then(setRegistros)
    loadAllCategories().then(setCategorias)
    loadEmpleados().then(setEmpleados)
    loadCustomVisitTypes().then(setCustomTypes)
  }, [])

  const visitOptions: VisitOption[] = useMemo(
    () => [
      ...VISIT_TYPES.map((v) => ({
        value: v.id,
        label: v.label,
        color: TONE_COLOR[v.tone],
      })),
      ...customTypes.map((n) => ({ value: n, label: n, color: CUSTOM_VISIT_COLOR })),
    ],
    [customTypes],
  )

  async function registrar() {
    if (!visit) return
    const next = await addRegistro({ visit, demand, userId: empleadoId })
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

  async function agregarTipo() {
    const name = nuevoTipo.trim()
    if (!name) return
    const next = await addVisitType(name)
    setCustomTypes(next)
    setNuevoTipo('')
    // Deja seleccionado el nuevo tipo para registrarlo al toque.
    setVisit(next.find((t) => t.toLowerCase() === name.toLowerCase()) ?? name)
  }

  const filtrados = useMemo(() => {
    const desdeMs = desde ? new Date(`${desde}T00:00:00`).getTime() : -Infinity
    const hastaMs = hasta ? new Date(`${hasta}T23:59:59.999`).getTime() : Infinity
    return registros.filter((r) => r.ts >= desdeMs && r.ts <= hastaMs)
  }, [registros, desde, hasta])

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
            {visitOptions.map((o) => (
              <VisitButton
                key={o.value}
                label={o.label}
                color={o.color}
                selected={visit === o.value}
                onSelect={() => setVisit(visit === o.value ? null : o.value)}
              />
            ))}
          </div>

          {/* Caja para sumar tipos de cliente al catálogo único */}
          <div className="mt-2 flex flex-col gap-2">
            <label
              htmlFor="nuevo-tipo"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Agregar otro tipo de cliente
            </label>
            <div className="flex gap-2">
              <input
                id="nuevo-tipo"
                value={nuevoTipo}
                autoComplete="off"
                placeholder="Ej: Vino a pagar una cuota"
                onChange={(e) => setNuevoTipo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    agregarTipo()
                  }
                }}
                className="min-h-[52px] flex-1 rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/25"
              />
              <button
                type="button"
                onClick={agregarTipo}
                disabled={!nuevoTipo.trim()}
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

        {/* PASO 2 — Quién atendió */}
        <section className="flex flex-col gap-3 border-t border-slate-200 pt-7 dark:border-slate-800">
          <SectionTitle
            paso="2"
            title="¿Quién atendió?"
            hint="Se guarda para medir quién atiende y quién convierte más."
          />
          <select
            value={empleadoId ?? ''}
            onChange={(e) => setEmpleadoId(e.target.value || null)}
            aria-label="Empleado que atendió"
            className="min-h-[52px] w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/25"
          >
            <option value="">Sin asignar</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </section>

        {/* PASO 3 — Demanda no cubierta */}
        <section className="flex flex-col gap-3 border-t border-slate-200 pt-7 dark:border-slate-800">
          <SectionTitle
            paso="3"
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
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Estadísticas
            </h2>
            <RangoFechas
              desde={desde}
              hasta={hasta}
              onDesde={setDesde}
              onHasta={setHasta}
            />
          </div>

          <Resumen registros={filtrados} />

          <ChartCard title="Embudo de visitas">
            <BarChart
              data={dataVisitas(filtrados, visitOptions)}
              unit="pers."
              emptyHint="Registrá visitas para ver el embudo."
            />
          </ChartCard>

          <ChartCard
            title="Quién atiende más"
            subtitle="Visitas registradas por cada empleado en el período."
          >
            <BarChart
              data={dataPorEmpleado(filtrados, empleados)}
              unit="vis."
              emptyHint="Todavía no hay visitas con empleado asignado."
            />
          </ChartCard>

          <ChartCard
            title="Quién convierte más"
            subtitle="Ventas cerradas (preguntó precio y compró) por empleado."
          >
            <BarChart
              data={dataPorEmpleado(
                filtrados.filter((r) => r.visit === 'pregunto_compro'),
                empleados,
              )}
              unit="vent."
              emptyHint="Todavía no hay ventas registradas."
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

function dataVisitas(registros: Registro[], opciones: VisitOption[]): BarDatum[] {
  return opciones.map((o) => ({
    label: o.label,
    value: registros.filter((r) => r.visit === o.value).length,
    color: o.color,
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

function dataPorEmpleado(registros: Registro[], empleados: Empleado[]): BarDatum[] {
  const nombreDe = (id: string | null): string => {
    if (!id) return 'Sin asignar'
    return empleados.find((e) => e.id === id)?.nombre ?? '—'
  }
  const cuenta = new Map<string, number>()
  for (const r of registros) {
    const nombre = nombreDe(r.userId)
    cuenta.set(nombre, (cuenta.get(nombre) ?? 0) + 1)
  }
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, color: EMPLEADO_COLOR }))
}

/* ---------- Subcomponentes ---------- */

function RangoFechas({
  desde,
  hasta,
  onDesde,
  onHasta,
}: {
  desde: string
  hasta: string
  onDesde: (v: string) => void
  onHasta: (v: string) => void
}) {
  return (
    <div className="flex items-end gap-2">
      <DateField id="fecha-desde" label="Desde" value={desde} max={hasta} onChange={onDesde} />
      <DateField id="fecha-hasta" label="Hasta" value={hasta} min={desde} onChange={onHasta} />
    </div>
  )
}

function DateField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string
  label: string
  value: string
  min?: string
  max?: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm tabular-nums text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/25 dark:[color-scheme:dark]"
      />
    </div>
  )
}

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
  label,
  color,
  selected,
  onSelect,
}: {
  label: string
  color: string
  selected: boolean
  onSelect: () => void
}) {
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
      <span className="flex-1">{label}</span>
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
