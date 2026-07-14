import { useEffect, useMemo, useState } from 'react'
import {
  loadContactos,
  addContacto,
  updateContacto,
  deleteContacto,
  contactoVacio,
  filtrarPorRango,
  ordenar,
  ESTADOS,
  ORDENES,
  SEGMENTOS_SUGERIDOS,
  type Contacto,
  type ContactoInput,
  type Orden,
} from '../lib/calendarios'
import { exportarContactosPDF } from '../lib/exportar'
import { fmtFecha } from '../lib/asistencia'

type Alcance = 'todo' | 'rango'

const INPUT =
  'min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:[color-scheme:dark]'

export default function Calendarios() {
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Solo la fila abierta se edita: el resto son renglones compactos.
  const [abierto, setAbierto] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<Record<string, ContactoInput>>({})
  const [guardando, setGuardando] = useState<string | null>(null)
  const [aBorrar, setABorrar] = useState<Contacto | null>(null)

  // Filtros de la lista
  const [orden, setOrden] = useState<Orden>('fecha_desc')
  const [filtroEstado, setFiltroEstado] = useState<string>('')
  const [busqueda, setBusqueda] = useState('')

  // Enviar resultados
  const [enviarAbierto, setEnviarAbierto] = useState(false)
  const [alcance, setAlcance] = useState<Alcance>('todo')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    loadContactos()
      .then(setContactos)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setCargando(false))
  }, [])

  function valores(c: Contacto): ContactoInput {
    return borrador[c.id] ?? c
  }

  function editar(c: Contacto, patch: Partial<ContactoInput>) {
    setBorrador((prev) => ({ ...prev, [c.id]: { ...valores(c), ...patch } }))
  }

  async function crearFila() {
    setError(null)
    try {
      const nuevo = await addContacto(contactoVacio())
      setContactos((prev) => [nuevo, ...prev])
      setAbierto(nuevo.id) // la fila nueva arranca abierta para completarla
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function guardar(c: Contacto) {
    const cambios = borrador[c.id]
    if (!cambios) return
    setGuardando(c.id)
    setError(null)
    try {
      const actualizado = await updateContacto(c.id, cambios)
      setContactos((prev) => prev.map((x) => (x.id === c.id ? actualizado : x)))
      setBorrador((prev) => {
        const next = { ...prev }
        delete next[c.id]
        return next
      })
      setAbierto(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(null)
    }
  }

  /** Cierra la fila descartando lo no guardado. */
  function cancelar(id: string) {
    setBorrador((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setAbierto(null)
  }

  async function confirmarBorrado() {
    if (!aBorrar) return
    const id = aBorrar.id
    setABorrar(null)
    try {
      await deleteContacto(id)
      setContactos((prev) => prev.filter((c) => c.id !== id))
      if (abierto === id) setAbierto(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // Lo que se ve en la lista: filtrado por estado y texto, después ordenado.
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const filtrados = contactos.filter((c) => {
      if (filtroEstado && c.estado !== filtroEstado) return false
      if (!q) return true
      return (
        c.nombre.toLowerCase().includes(q) ||
        c.segmento.toLowerCase().includes(q) ||
        c.wsp.includes(q)
      )
    })
    return ordenar(filtrados, orden)
  }, [contactos, orden, filtroEstado, busqueda])

  const seleccionados = useMemo(
    () => (alcance === 'todo' ? contactos : filtrarPorRango(contactos, desde, hasta)),
    [contactos, alcance, desde, hasta]
  )

  async function enviarResultados() {
    if (exportando) return
    setExportando(true)
    setError(null)
    try {
      const periodo =
        alcance === 'todo'
          ? 'Todos los contactos'
          : `Del ${desde ? fmtFecha(desde) : '—'} al ${hasta ? fmtFecha(hasta) : '—'}`
      const sufijo = alcance === 'todo' ? 'todo' : `${desde || 'inicio'}_a_${hasta || 'hoy'}`
      // Del más viejo al más nuevo: el jefe lee la evolución en orden.
      const orden = [...seleccionados].sort((a, b) => a.dia.localeCompare(b.dia))
      await exportarContactosPDF(orden, periodo, `calendario-contactos_${sufijo}.pdf`)
      setEnviarAbierto(false)
    } catch (e) {
      setError(`No se pudo generar el PDF. ${e instanceof Error ? e.message : e}`)
    } finally {
      setExportando(false)
    }
  }

  return (
    <main className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex max-w-3xl flex-col px-5 pb-16 pt-6">
        <header className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Registro de calendarios
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Seguimiento de los contactos de la cartera. Tocá un contacto para editarlo.
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={crearFila}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            <PlusIcon /> Nuevo contacto
          </button>
          <button
            type="button"
            onClick={() => setEnviarAbierto(true)}
            disabled={contactos.length === 0}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-600 px-4 text-sm font-semibold text-emerald-700 transition active:scale-[0.98] hover:bg-emerald-50 disabled:opacity-40 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
          >
            <SendIcon /> Enviar resultados
          </button>
        </div>

        {/* Buscar + ordenar + filtrar por estado */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={busqueda}
            placeholder="Buscar por nombre, segmento o número…"
            onChange={(e) => setBusqueda(e.target.value)}
            className={`${INPUT} min-w-[180px] flex-1`}
          />
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as Orden)}
            aria-label="Ordenar por"
            className={`${INPUT} w-auto`}
          >
            {ORDENES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            aria-label="Filtrar por estado"
            className={`${INPUT} w-auto`}
          >
            <option value="">Todos</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        {cargando ? (
          <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>
        ) : contactos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Todavía no hay contactos. Tocá «Nuevo contacto» para cargar el primero.
          </p>
        ) : visibles.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Ningún contacto coincide con la búsqueda.
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">
              {visibles.length} de {contactos.length} contactos
            </p>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {visibles.map((c) => {
                const v = valores(c)
                const sucio = borrador[c.id] !== undefined
                const editando = abierto === c.id

                if (!editando) {
                  // Renglón compacto: una línea por contacto.
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setAbierto(c.id)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <span className="w-12 shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500">
                          {c.dia ? fmtFecha(c.dia).slice(0, 5) : '—'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {c.nombre || <span className="text-slate-400">Sin nombre</span>}
                          </span>
                          {(c.segmento || c.notas) && (
                            <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                              {[c.segmento, c.notas].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
                        {sucio && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                            sin guardar
                          </span>
                        )}
                        <EstadoChip estado={v.estado} />
                      </button>
                    </li>
                  )
                }

                // Fila abierta: formulario completo.
                return (
                  <li key={c.id} className="bg-slate-50 p-4 dark:bg-slate-800/40">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Campo label="Nombre">
                        <input
                          autoFocus
                          value={v.nombre}
                          placeholder="Nombre y apellido"
                          onChange={(e) => editar(c, { nombre: e.target.value })}
                          className={INPUT}
                        />
                      </Campo>
                      <Campo label="Día">
                        <input
                          type="date"
                          value={v.dia}
                          onChange={(e) => editar(c, { dia: e.target.value })}
                          className={INPUT}
                        />
                      </Campo>
                      <Campo label="Segmento">
                        <input
                          list="segmentos"
                          value={v.segmento}
                          placeholder="Ej: Gama alta otoño/invierno"
                          onChange={(e) => editar(c, { segmento: e.target.value })}
                          className={INPUT}
                        />
                      </Campo>
                      <Campo label="Estado">
                        <select
                          value={v.estado}
                          onChange={(e) => editar(c, { estado: e.target.value })}
                          className={INPUT}
                        >
                          {ESTADOS.map((e) => (
                            <option key={e} value={e}>
                              {e}
                            </option>
                          ))}
                        </select>
                      </Campo>
                      <Campo label="Número de WhatsApp">
                        <input
                          inputMode="tel"
                          value={v.wsp}
                          placeholder="2215678449"
                          onChange={(e) => editar(c, { wsp: e.target.value })}
                          className={INPUT}
                        />
                      </Campo>
                      <Campo label="Notas" ancho>
                        <textarea
                          value={v.notas}
                          rows={2}
                          placeholder="Cómo salió la charla: apertura, conversación y si hubo cierre."
                          onChange={(e) => editar(c, { notas: e.target.value })}
                          className={`${INPUT} min-h-[64px] resize-y py-2`}
                        />
                      </Campo>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setABorrar(c)}
                        className="flex h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      >
                        <TrashIcon /> Borrar
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => cancelar(c.id)}
                          className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition active:scale-[0.98] dark:border-slate-700 dark:text-slate-300"
                        >
                          {sucio ? 'Descartar' : 'Cerrar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => guardar(c)}
                          disabled={!sucio || guardando === c.id}
                          className="min-h-[44px] rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-30 dark:bg-emerald-500"
                        >
                          {guardando === c.id ? 'Guardando…' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        <datalist id="segmentos">
          {SEGMENTOS_SUGERIDOS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      {/* Enviar resultados → PDF */}
      {enviarAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setEnviarAbierto(false)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div>
              <h2 className="text-lg font-bold">Enviar resultados</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Se descarga un PDF con los contactos para mandarle al jefe.
              </p>
            </div>

            <div className="flex gap-2">
              {(['todo', 'rango'] as Alcance[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAlcance(a)}
                  aria-pressed={alcance === a}
                  className={`min-h-[44px] flex-1 rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
                    alcance === a
                      ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                      : 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {a === 'todo' ? 'Todo' : 'Rango'}
                </button>
              ))}
            </div>

            {alcance === 'rango' && (
              <div className="flex items-end gap-2">
                <Campo label="Desde">
                  <input
                    type="date"
                    value={desde}
                    onChange={(e) => setDesde(e.target.value)}
                    className={INPUT}
                  />
                </Campo>
                <Campo label="Hasta">
                  <input
                    type="date"
                    value={hasta}
                    onChange={(e) => setHasta(e.target.value)}
                    className={INPUT}
                  />
                </Campo>
              </div>
            )}

            <p className="text-sm text-slate-500 dark:text-slate-400">
              {seleccionados.length === 0
                ? 'No hay contactos en ese rango.'
                : `Entran ${seleccionados.length} contacto${seleccionados.length === 1 ? '' : 's'}.`}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEnviarAbierto(false)}
                className="min-h-[48px] flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 transition active:scale-[0.98] dark:border-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={enviarResultados}
                disabled={exportando || seleccionados.length === 0}
                className="min-h-[48px] flex-1 rounded-xl bg-emerald-600 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-40 dark:bg-emerald-500"
              >
                {exportando ? 'Generando…' : 'Descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {aBorrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <button
            type="button"
            aria-label="Cancelar"
            onClick={() => setABorrar(null)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            className="relative flex w-full max-w-xs flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="text-base font-medium text-slate-800 dark:text-slate-100">
              ¿Borrar el contacto {aBorrar.nombre ? `"${aBorrar.nombre}"` : 'sin nombre'}?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setABorrar(null)}
                className="min-h-[48px] flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarBorrado}
                className="min-h-[48px] flex-1 rounded-xl bg-red-600 text-sm font-bold text-white dark:bg-red-500"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

/** Chip de estado: verde = enviado, ámbar = pendiente. */
function EstadoChip({ estado }: { estado: string }) {
  const pendiente = estado === 'Pendiente'
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        pendiente
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
      }`}
    >
      {estado || '—'}
    </span>
  )
}

function Campo({
  label,
  ancho,
  children,
}: {
  label: string
  ancho?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`flex flex-1 flex-col gap-1 ${ancho ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 3 10.5 13.5M21 3l-6.5 18-4-8-8-4L21 3Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  )
}
