import { useEffect, useMemo, useState } from 'react'
import { VISIT_TYPES, TONE_COLOR, CUSTOM_VISIT_COLOR, EMPLEADO_COLOR } from '../data/clientes'
import {
  loadRegistros,
  addRegistro,
  loadAllCategories,
  addCategory,
  deleteCategory,
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
  const [ventaAdicional, setVentaAdicional] = useState(false)
  const [esHabitual, setEsHabitual] = useState<boolean | null>(null)
  const [factura, setFactura] = useState<boolean | null>(null)
  const [recomendacion, setRecomendacion] = useState(false)
  const [redes, setRedes] = useState(false)
  const [volvio, setVolvio] = useState(false)
  const [nuevaCat, setNuevaCat] = useState('')
  const [nuevoTipo, setNuevoTipo] = useState('')
  const [guardado, setGuardado] = useState(false)
  // Categoría pendiente de confirmar borrado (modal in-app).
  const [catABorrar, setCatABorrar] = useState<string | null>(null)

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
    [customTypes]
  )

  async function registrar() {
    if (!visit) return
    const next = await addRegistro({
      visit,
      demand,
      userId: empleadoId,
      ventaAdicional,
      esHabitual,
      factura,
      recomendacion,
      redes,
      volvio,
    })
    setRegistros(next)
    setVisit(null)
    setDemand(null)
    setVentaAdicional(false)
    setEsHabitual(null)
    setFactura(null)
    setRecomendacion(false)
    setRedes(false)
    setVolvio(false)
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

  async function confirmarBorrado() {
    const nombre = catABorrar
    if (!nombre) return
    const next = await deleteCategory(nombre)
    setCategorias(next)
    if (demand === nombre) setDemand(null)
    setCatABorrar(null)
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
    const a = desde ? new Date(`${desde}T00:00:00`).getTime() : -Infinity
    const b = hasta ? new Date(`${hasta}T23:59:59.999`).getTime() : Infinity
    // Independiente del orden en que se cargaron las fechas.
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    return registros.filter((r) => r.ts >= lo && r.ts <= hi)
  }, [registros, desde, hasta])

  return (
    <main className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex max-w-md flex-col gap-8 px-5 pb-12 pt-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Registrá cada persona que entra.
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

          {/* Venta adicional: siempre disponible */}
          <VentaAdicionalCheck
            checked={ventaAdicional}
            enabled={true}
            onToggle={() => setVentaAdicional((v) => !v)}
          />

          {/* Factura: siempre disponible, con la aclaración */}
          <DualChoice
            label="Factura"
            hint="(solo si compró)"
            enabled={true}
            value={factura}
            onChange={setFactura}
            options={[
              { key: true, label: 'Con factura', color: '#059669', icon: <ReceiptIcon /> },
              { key: false, label: 'Sin factura', color: '#64748b', icon: <BanIcon /> },
            ]}
          />

          {/* Cliente nuevo o habitual: siempre disponible, con la aclaración */}
          <DualChoice
            label="Cliente nuevo o habitual"
            hint="(solo si compró)"
            enabled={true}
            value={esHabitual}
            onChange={setEsHabitual}
            options={[
              { key: false, label: 'Nuevo', color: '#0284c7', icon: <SparkIcon /> },
              { key: true, label: 'Habitual', color: '#7c3aed', icon: <RepeatIcon /> },
            ]}
          />

          {/* Cómo llegó el cliente */}
          <CheckCard
            label="Vino por recomendación"
            icon={<ThumbsUpIcon />}
            checked={recomendacion}
            onToggle={() => setRecomendacion((v) => !v)}
          />
          <CheckCard
            label="Vino por redes sociales"
            icon={<ShareIcon />}
            checked={redes}
            onToggle={() => setRedes((v) => !v)}
          />
          <CheckCard
            label="Volvió (ya había venido antes)"
            icon={<RepeatIcon />}
            checked={volvio}
            onToggle={() => setVolvio((v) => !v)}
          />

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
            title="¿Qué pidió?"
            hint="Opcional. Elegí la categoría del producto que pidió."
          />
          <div className="grid grid-cols-2 gap-3">
            {categorias.map((c) => {
              const active = demand === c
              return (
                <div key={c} className="relative">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDemand(active ? null : c)}
                    className={`flex min-h-[60px] w-full items-center justify-center rounded-2xl border px-3 pt-3 pb-1 text-center text-base font-semibold transition active:scale-[0.98] ${
                      active
                        ? 'border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-500 dark:text-slate-950'
                        : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                    }`}
                  >
                    {c}
                  </button>
                  {/* Tacho en la esquina: hit-area propia + stopPropagation para no
                      seleccionar la categoría al borrarla. */}
                  <button
                    type="button"
                    aria-label={`Borrar ${c}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setCatABorrar(c)
                    }}
                    className={`absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-lg transition active:scale-90 ${
                      active
                        ? 'text-white/80 hover:bg-white/20'
                        : 'text-slate-300 hover:bg-slate-100 hover:text-red-500 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-red-400'
                    }`}
                  >
                    <TrashIcon />
                  </button>
                </div>
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
            <RangoFechas desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
          </div>

          <Resumen registros={filtrados} />

          <ChartCard title="Tipo de visitas">
            <BarChart
              data={dataVisitas(filtrados, visitOptions)}
              unit="pers."
              emptyHint="Todavia no vino nadie, si alguien vino: registrá."
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
                empleados
              )}
              unit="vent."
              emptyHint="Todavía no hay ventas registradas."
            />
          </ChartCard>

          <ChartCard
            title="Ventas adicionales"
            subtitle="Quién sumó una venta extra (upselling) en el período."
          >
            <BarChart
              data={dataPorEmpleado(
                filtrados.filter((r) => r.ventaAdicional),
                empleados
              )}
              unit="adic."
              emptyHint="Todavía no marcaste ventas adicionales."
            />
          </ChartCard>

          <ChartCard
            title="Clientes nuevos vs habituales"
            subtitle="De los que marcaste, cuántos eran nuevos y cuántos habituales."
          >
            <BarChart
              data={dataNuevoHabitual(filtrados)}
              unit="pers."
              emptyHint="Todavía no marcaste si son nuevos o habituales."
            />
          </ChartCard>

          <ChartCard
            title="Cómo llegó el cliente"
            subtitle="Recomendación, redes sociales o clientes que volvieron."
          >
            <BarChart
              data={dataOrigen(filtrados)}
              unit="pers."
              emptyHint="Todavía no marcaste cómo llegaron los clientes."
            />
          </ChartCard>

          <ChartCard
            title="Productos más pedidos"
            subtitle="Categorías que la gente pide (tengamos o no)."
          >
            <BarChart
              data={dataDemanda(filtrados)}
              unit="ped."
              emptyHint="Todavia no vino nadie al local"
            />
          </ChartCard>
        </section>
      </div>

      {catABorrar && (
        <ConfirmDialog
          mensaje={`¿Borrar "${catABorrar}" de la lista de productos?`}
          onCancel={() => setCatABorrar(null)}
          onConfirm={confirmarBorrado}
        />
      )}
    </main>
  )
}

function ConfirmDialog({
  mensaje,
  onCancel,
  onConfirm,
}: {
  mensaje: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <button
        type="button"
        aria-label="Cancelar"
        onClick={onCancel}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative flex w-full max-w-xs flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400">
            <TrashIcon />
          </span>
          <p className="pt-1 text-base font-medium text-slate-800 dark:text-slate-100">{mensaje}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[48px] flex-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[48px] flex-1 rounded-xl bg-red-600 text-sm font-bold text-white transition active:scale-[0.98] dark:bg-red-500"
          >
            Borrar
          </button>
        </div>
      </div>
    </div>
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

function dataNuevoHabitual(registros: Registro[]): BarDatum[] {
  const nuevos = registros.filter((r) => r.esHabitual === false).length
  const habituales = registros.filter((r) => r.esHabitual === true).length
  return [
    { label: 'Nuevos', value: nuevos, color: '#0284c7' },
    { label: 'Habituales', value: habituales, color: '#7c3aed' },
  ]
}

function dataOrigen(registros: Registro[]): BarDatum[] {
  return [
    {
      label: 'Recomendación',
      value: registros.filter((r) => r.recomendacion).length,
      color: '#0d9488',
    },
    { label: 'Redes sociales', value: registros.filter((r) => r.redes).length, color: '#7c3aed' },
    { label: 'Volvió', value: registros.filter((r) => r.volvio).length, color: '#d97706' },
  ]
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
      <DateField id="fecha-desde" label="Desde" value={desde} onChange={onDesde} />
      <DateField id="fecha-hasta" label="Hasta" value={hasta} onChange={onHasta} />
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
  const adicionales = registros.filter((r) => r.ventaAdicional).length
  // Venta adicional sobre la gente que compró.
  const adicEnCompra = registros.filter(
    (r) => r.visit === 'pregunto_compro' && r.ventaAdicional
  ).length
  const pctAdic = compraron > 0 ? Math.round((adicEnCompra / compraron) * 100) : 0

  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat label="Entraron" value={total} />
      <Stat label="Compraron" value={compraron} accent />
      <Stat label="Conversión" value={`${conversion}%`} accent />
      <Stat label="Ventas adic." value={adicionales} accent />
      <Stat label="Venta adicional sobre compras" value={`${pctAdic}%`} accent wide />
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
  wide,
}: {
  label: string
  value: number | string
  accent?: boolean
  wide?: boolean
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-4 dark:border-slate-800 dark:bg-slate-900 ${
        wide ? 'col-span-2' : ''
      }`}
    >
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

function SectionTitle({ paso, title, hint }: { paso: string; title: string; hint?: string }) {
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

function VentaAdicionalCheck({
  checked,
  enabled,
  onToggle,
}: {
  checked: boolean
  enabled: boolean
  onToggle: () => void
}) {
  const estado = !enabled ? 'off-disabled' : checked ? 'on' : 'off'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={!enabled}
      onClick={onToggle}
      className={`flex min-h-[68px] w-full items-center gap-3 rounded-2xl border px-4 text-left transition active:scale-[0.98] ${
        estado === 'off-disabled'
          ? 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-70 dark:border-slate-800 dark:bg-slate-900/50'
          : estado === 'on'
            ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950'
            : 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          estado === 'off-disabled'
            ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
            : estado === 'on'
              ? 'bg-white/20 text-white dark:text-slate-950'
              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
        }`}
      >
        <CartPlusIcon />
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span
          className={`text-lg font-semibold ${
            estado === 'off-disabled' ? 'text-slate-400 dark:text-slate-600' : ''
          }`}
        >
          Venta adicional
        </span>
        <span
          className={`text-xs ${
            estado === 'on'
              ? 'text-white/80 dark:text-slate-950/70'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {enabled
            ? 'Se llevó algo más de lo que venía a buscar.'
            : 'Se desbloquea si compró o vino a buscar algo puntual.'}
        </span>
      </span>
      <CheckSquare checked={estado === 'on'} />
    </button>
  )
}

function CheckCard({
  label,
  icon,
  checked,
  onToggle,
}: {
  label: string
  icon: React.ReactNode
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl border px-4 text-left transition active:scale-[0.98] ${
        checked
          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950'
          : 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          checked
            ? 'bg-white/20 text-white dark:text-slate-950'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
        }`}
      >
        {icon}
      </span>
      <span className="flex-1 text-base font-semibold">{label}</span>
      <CheckSquare checked={checked} />
    </button>
  )
}

function DualChoice({
  label,
  hint,
  options,
  value,
  enabled,
  onChange,
}: {
  label: string
  hint?: string
  options: { key: boolean; label: string; color: string; icon: React.ReactNode }[]
  value: boolean | null
  enabled: boolean
  onChange: (v: boolean | null) => void
}) {
  return (
    <div className={`flex flex-col gap-2 ${enabled ? '' : 'opacity-70'}`}>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {hint && <span className="font-normal text-slate-400 dark:text-slate-500"> {hint}</span>}
      </span>
      <div className="grid grid-cols-2 gap-3">
        {options.map((o) => {
          const active = enabled && value === o.key
          return (
            <button
              key={String(o.key)}
              type="button"
              aria-pressed={active}
              disabled={!enabled}
              onClick={() => onChange(active ? null : o.key)}
              style={active ? { backgroundColor: o.color, borderColor: o.color } : undefined}
              className={`flex min-h-[64px] items-center justify-center gap-2 rounded-2xl border text-base font-semibold transition active:scale-[0.98] ${
                !enabled
                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-600'
                  : active
                    ? 'text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              }`}
            >
              {o.icon}
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CheckSquare({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
        checked ? 'border-white bg-white/25' : 'border-slate-300 dark:border-slate-600'
      }`}
    >
      {checked && (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </span>
  )
}

function CartPlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h2l2.5 12.5A2 2 0 0 0 8.5 17H18a2 2 0 0 0 2-1.6L21 9H6" />
      <path d="M14 5h4M16 3v4" />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </svg>
  )
}

function RepeatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function ReceiptIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 2v20l2-1.5L8 22l2-1.5L12 22l2-1.5L16 22l2-1.5L20 22V2l-2 1.5L16 2l-2 1.5L12 2l-2 1.5L8 2 6 3.5 4 2Z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  )
}

function BanIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </svg>
  )
}

function ThumbsUpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 10v11" />
      <path d="M7 10 11 3a2 2 0 0 1 2.7 1.8V9h5a2 2 0 0 1 2 2.3l-1.3 7A2 2 0 0 1 18.4 20H7" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8 15.8 6.2M8.2 13.2l7.6 4.6" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
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
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
