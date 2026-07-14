import { useMemo, useRef, useState } from 'react'
import {
  parseUdiskLog,
  empleadosDe,
  sugerirHorario,
  horarioVacio,
  generarReporte,
  fmtFecha,
  fmtHoras,
  nombreDia,
  nombrePropio,
  type Marca,
  type Reporte,
  type HorarioEmpleado,
} from '../lib/asistencia'
import { exportarPDF, exportarDOCX } from '../lib/exportar'

type Paso = 'archivo' | 'config' | 'reporte'

const DIAS = [
  { id: 1, label: 'Lun' },
  { id: 2, label: 'Mar' },
  { id: 3, label: 'Mié' },
  { id: 4, label: 'Jue' },
  { id: 5, label: 'Vie' },
  { id: 6, label: 'Sáb' },
  { id: 0, label: 'Dom' },
]

const VENTANA_DUP_MIN = 10

export default function Asistencia() {
  const [paso, setPaso] = useState<Paso>('archivo')
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [lineasIgnoradas, setLineasIgnoradas] = useState(0)
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)

  // Config (las "preguntas" del wizard)
  const [incluidos, setIncluidos] = useState<Set<string>>(new Set())
  const [horarios, setHorarios] = useState<Record<string, HorarioEmpleado>>({})
  const [toleranciaRaw, setToleranciaRaw] = useState('10')
  const [diasLaborables, setDiasLaborables] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6]))

  const [reporte, setReporte] = useState<Reporte | null>(null)
  const [exportando, setExportando] = useState<'pdf' | 'docx' | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const empleados = useMemo(() => empleadosDe(marcas), [marcas])

  async function cargarArchivo(file: File | undefined) {
    setError(null)
    if (!file) return
    if (!/\.(txt|log|dat)$/i.test(file.name)) {
      setError('El archivo tiene que ser el .txt que exporta el reloj de huellas.')
      return
    }
    const texto = await file.text()
    const r = parseUdiskLog(texto)
    if (r.marcas.length === 0) {
      setError('No encontré ninguna marca válida en el archivo. ¿Es el .txt del reloj (formato UDISKLOG)?')
      return
    }
    setMarcas(r.marcas)
    setLineasIgnoradas(r.lineasIgnoradas)
    setNombreArchivo(file.name)

    const emps = empleadosDe(r.marcas)
    setIncluidos(new Set(emps.map((e) => e.enNo)))
    // El doble turno y los horarios salen detectados de las propias marcas.
    const sug: Record<string, HorarioEmpleado> = {}
    for (const e of emps) sug[e.enNo] = sugerirHorario(r.marcas, e.enNo)
    setHorarios(sug)
    setPaso('config')
  }

  function toggleIncluido(enNo: string) {
    setIncluidos((prev) => {
      const s = new Set(prev)
      if (s.has(enNo)) s.delete(enNo)
      else s.add(enNo)
      return s
    })
  }

  /** Actualiza el horario de un empleado sin pisar el resto. */
  function editarHorario(enNo: string, patch: Partial<HorarioEmpleado>) {
    setHorarios((prev) => ({
      ...prev,
      [enNo]: { ...(prev[enNo] ?? horarioVacio()), ...patch },
    }))
  }

  function editarTurno(
    enNo: string,
    turno: 'turno1' | 'turno2',
    campo: 'entrada' | 'salida',
    valor: string
  ) {
    const actual = horarios[enNo] ?? horarioVacio()
    editarHorario(enNo, {
      [turno]: { ...actual[turno], [campo]: valor || null },
    } as Partial<HorarioEmpleado>)
  }

  function toggleDia(id: number) {
    setDiasLaborables((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  function generar() {
    const tolerancia = Number(toleranciaRaw)
    const rep = generarReporte(marcas, {
      incluidos,
      horarios,
      toleranciaMin: Number.isFinite(tolerancia) ? tolerancia : 10,
      diasLaborables,
      ventanaDupMin: VENTANA_DUP_MIN,
    })
    setReporte(rep)
    setPaso('reporte')
  }

  async function exportar(tipo: 'pdf' | 'docx') {
    if (!reporte || exportando) return
    setExportando(tipo)
    setError(null)
    try {
      if (tipo === 'pdf') await exportarPDF(reporte)
      else await exportarDOCX(reporte)
    } catch (e) {
      setError(`No se pudo generar el ${tipo.toUpperCase()}. Probá de nuevo. (${e instanceof Error ? e.message : e})`)
    } finally {
      setExportando(null)
    }
  }

  function reiniciar() {
    setPaso('archivo')
    setMarcas([])
    setReporte(null)
    setNombreArchivo('')
    setError(null)
  }

  const desde = marcas[0]?.fecha
  const hasta = marcas[marcas.length - 1]?.fecha

  return (
    <main className="bg-slate-50 text-slate-900 antialiased transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex max-w-2xl flex-col px-5 pb-16 pt-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Registro de llegada
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Subí el .txt del reloj de huellas y descargá el reporte de entradas y salidas.
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {/* ── Paso 1: archivo ─────────────────────────────────────────── */}
        {paso === 'archivo' && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setArrastrando(true)
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault()
              setArrastrando(false)
              void cargarArchivo(e.dataTransfer.files[0])
            }}
            className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
              arrastrando
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                : 'border-slate-300 bg-white hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-600'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10 text-emerald-600 dark:text-emerald-500" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            <div>
              <p className="font-semibold">Tirá acá el archivo .txt</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                o tocá para elegirlo — es el que descargás del reloj (ej. «1 a 31-5-26.txt»)
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".txt,.log,.dat,text/plain"
              className="hidden"
              onChange={(e) => void cargarArchivo(e.target.files?.[0] ?? undefined)}
            />
          </div>
        )}

        {/* ── Paso 2: preguntas del wizard ────────────────────────────── */}
        {paso === 'config' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="font-semibold">{nombreArchivo}</span> · {marcas.length} marcas ·{' '}
              {empleados.length} personas · del {fmtFecha(desde!)} al {fmtFecha(hasta!)}
              {lineasIgnoradas > 0 && ` · ${lineasIgnoradas} líneas ilegibles ignoradas`}
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-semibold">¿Qué días trabaja la empresa?</h2>
              <p className="mb-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Se usa para detectar ausencias. Un día en que no marcó nadie (feriado) no cuenta.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DIAS.map((d) => {
                  const activo = diasLaborables.has(d.id)
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDia(d.id)}
                      aria-pressed={activo}
                      className={`min-h-[40px] rounded-full px-4 text-sm font-medium transition active:scale-95 ${
                        activo
                          ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-semibold">Tolerancia</h2>
              <p className="mb-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Minutos de gracia sobre el horario esperado: se marca tardanza si entra más tarde,
                y salida anticipada si se va más temprano.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={120}
                  inputMode="numeric"
                  value={toleranciaRaw}
                  onChange={(e) => setToleranciaRaw(e.target.value)}
                  className="w-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-950"
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">minutos</span>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-semibold">Personas y horarios</h2>
              <p className="mb-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                El doble turno y los horarios vienen detectados de las propias marcas de cada
                persona. Ajustá lo que haga falta; un campo vacío = no se controla.
              </p>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {empleados.map((e) => {
                  const activo = incluidos.has(e.enNo)
                  const h = horarios[e.enNo] ?? horarioVacio()
                  return (
                    <li key={e.enNo} className="flex flex-col gap-2.5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={activo}
                            onChange={() => toggleIncluido(e.enNo)}
                            className="h-5 w-5 rounded accent-emerald-600"
                          />
                          <span className={`text-sm font-semibold ${activo ? '' : 'text-slate-400 line-through dark:text-slate-600'}`}>
                            {nombrePropio(e.nombre)}
                          </span>
                        </label>
                        <label className={`flex cursor-pointer items-center gap-2 text-xs font-medium ${activo ? 'text-slate-600 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600'}`}>
                          <input
                            type="checkbox"
                            checked={h.dobleTurno}
                            disabled={!activo}
                            onChange={() => editarHorario(e.enNo, { dobleTurno: !h.dobleTurno })}
                            className="h-4 w-4 rounded accent-emerald-600"
                          />
                          Doble turno
                        </label>
                      </div>

                      <div className={`flex flex-col gap-1.5 pl-8 ${activo ? '' : 'opacity-40'}`}>
                        <HorarioTurno
                          etiqueta={h.dobleTurno ? 'Turno mañana' : 'Jornada'}
                          entrada={h.turno1.entrada ?? ''}
                          salida={h.turno1.salida ?? ''}
                          disabled={!activo}
                          onEntrada={(v) => editarTurno(e.enNo, 'turno1', 'entrada', v)}
                          onSalida={(v) => editarTurno(e.enNo, 'turno1', 'salida', v)}
                        />
                        {h.dobleTurno && (
                          <HorarioTurno
                            etiqueta="Turno tarde"
                            entrada={h.turno2.entrada ?? ''}
                            salida={h.turno2.salida ?? ''}
                            disabled={!activo}
                            onEntrada={(v) => editarTurno(e.enNo, 'turno2', 'entrada', v)}
                            onSalida={(v) => editarTurno(e.enNo, 'turno2', 'salida', v)}
                          />
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={reiniciar}
                className="min-h-[52px] rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-600 transition active:scale-[0.98] hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Otro archivo
              </button>
              <button
                type="button"
                onClick={generar}
                disabled={incluidos.size === 0}
                className="min-h-[52px] flex-1 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] hover:bg-emerald-700 disabled:opacity-40 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                Generar reporte
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 3: reporte y descarga ──────────────────────────────── */}
        {paso === 'reporte' && reporte && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Personas', valor: String(reporte.empleados.length) },
                {
                  label: 'Horas totales',
                  valor: fmtHoras(reporte.empleados.reduce((a, e) => a + e.totalMinutos, 0)),
                },
                {
                  label: 'Tardanzas',
                  valor: String(reporte.empleados.reduce((a, e) => a + e.tardanzas, 0)),
                },
                {
                  label: 'Se fueron antes',
                  valor: String(reporte.empleados.reduce((a, e) => a + e.salidasTempranas, 0)),
                },
                {
                  label: 'Ausencias',
                  valor: String(reporte.empleados.reduce((a, e) => a + e.ausencias.length, 0)),
                },
              ].map((c) => (
                <div key={c.label} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{c.label}</p>
                  <p className="text-lg font-bold">{c.valor}</p>
                </div>
              ))}
            </div>

            {(reporte.duplicados.length > 0 ||
              reporte.empleados.some((e) => e.dias.some((d) => d.incompleto))) && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                <p className="font-semibold">Revisado por el algoritmo:</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                  {reporte.duplicados.length > 0 && (
                    <li>
                      {reporte.duplicados.length} marca(s) doble(s) descartada(s):{' '}
                      {reporte.duplicados
                        .map((d) => `${nombrePropio(d.nombre)} ${fmtFecha(d.fecha).slice(0, 5)} (${d.horaOriginal} y ${d.hora})`)
                        .join(' · ')}
                    </li>
                  )}
                  {reporte.empleados.flatMap((e) =>
                    e.dias
                      .filter((d) => d.incompleto)
                      .map((d) => (
                        <li key={e.enNo + d.fecha}>
                          {nombrePropio(e.nombre)} el {fmtFecha(d.fecha).slice(0, 5)}: cantidad impar de
                          marcas — falta una entrada o salida.
                        </li>
                      ))
                  )}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void exportar('pdf')}
                disabled={exportando !== null}
                className="min-h-[52px] flex-1 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                {exportando === 'pdf' ? 'Generando…' : 'Descargar PDF'}
              </button>
              <button
                type="button"
                onClick={() => void exportar('docx')}
                disabled={exportando !== null}
                className="min-h-[52px] flex-1 rounded-xl border border-emerald-600 px-5 text-sm font-semibold text-emerald-700 transition active:scale-[0.98] hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
              >
                {exportando === 'docx' ? 'Generando…' : 'Descargar Word'}
              </button>
            </div>

            {/* Vista previa */}
            {reporte.empleados.map((emp) => (
              <section key={emp.enNo} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <header className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <h3 className="font-semibold">{nombrePropio(emp.nombre)}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {emp.diasTrabajados} días · {fmtHoras(emp.totalMinutos)} · {emp.tardanzas} tardanzas ·{' '}
                    {emp.salidasTempranas} salidas antes · {emp.ausencias.length} ausencias
                  </p>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 dark:text-slate-500">
                        <th className="px-4 py-2 font-medium">Fecha</th>
                        <th className="px-2 py-2 font-medium">Entrada</th>
                        <th className="px-2 py-2 font-medium">Salida</th>
                        <th className="px-2 py-2 font-medium">Entrada</th>
                        <th className="px-2 py-2 font-medium">Salida</th>
                        <th className="px-2 py-2 font-medium">Horas</th>
                        <th className="px-4 py-2 font-medium">Obs.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {emp.dias.map((d) => (
                        <tr
                          key={d.fecha}
                          className={
                            d.tardeMin !== null || d.tempranoMin !== null
                              ? 'bg-amber-50 dark:bg-amber-950/30'
                              : ''
                          }
                        >
                          <td className="whitespace-nowrap px-4 py-1.5">
                            {fmtFecha(d.fecha).slice(0, 5)} <span className="text-slate-400">{nombreDia(d.fecha)}</span>
                          </td>
                          <td className="px-2 py-1.5">{d.turnos[0]?.entrada ?? '—'}</td>
                          <td className="px-2 py-1.5">{d.turnos[0]?.salida ?? '—'}</td>
                          <td className="px-2 py-1.5">{d.turnos[1]?.entrada ?? '—'}</td>
                          <td className="px-2 py-1.5">{d.turnos[1]?.salida ?? '—'}</td>
                          <td className="whitespace-nowrap px-2 py-1.5">{d.minutos > 0 ? fmtHoras(d.minutos) : '—'}</td>
                          <td className="px-4 py-1.5 text-amber-700 dark:text-amber-400">
                            {[
                              d.tardeMin !== null ? `Tarde +${d.tardeMin} min` : null,
                              d.tempranoMin !== null ? `Se fue ${d.tempranoMin} min antes` : null,
                              d.incompleto ? 'Falta una marca' : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {emp.ausencias.length > 0 && (
                  <p className="border-t border-slate-100 px-4 py-2 text-xs text-red-600 dark:border-slate-800 dark:text-red-400">
                    Ausencias: {emp.ausencias.map((f) => `${nombreDia(f)} ${fmtFecha(f).slice(0, 5)}`).join(', ')}
                  </p>
                )}
              </section>
            ))}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaso('config')}
                className="min-h-[52px] flex-1 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-600 transition active:scale-[0.98] hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Ajustar opciones
              </button>
              <button
                type="button"
                onClick={reiniciar}
                className="min-h-[52px] flex-1 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-600 transition active:scale-[0.98] hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Otro archivo
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

/** Par entrada/salida esperadas de un turno. */
function HorarioTurno({
  etiqueta,
  entrada,
  salida,
  disabled,
  onEntrada,
  onSalida,
}: {
  etiqueta: string
  entrada: string
  salida: string
  disabled: boolean
  onEntrada: (v: string) => void
  onSalida: (v: string) => void
}) {
  const clase =
    'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:[color-scheme:dark]'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-xs text-slate-500 dark:text-slate-400">{etiqueta}</span>
      <input
        type="time"
        aria-label={`${etiqueta}: entrada`}
        value={entrada}
        disabled={disabled}
        onChange={(e) => onEntrada(e.target.value)}
        className={clase}
      />
      <span className="text-xs text-slate-400">a</span>
      <input
        type="time"
        aria-label={`${etiqueta}: salida`}
        value={salida}
        disabled={disabled}
        onChange={(e) => onSalida(e.target.value)}
        className={clase}
      />
    </div>
  )
}
