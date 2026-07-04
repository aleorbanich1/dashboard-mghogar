import { useEffect, useMemo, useRef, useState } from 'react'
import rules from '../data/rules.json'
import { calcularPrecio, type CalcResult } from '../lib/calc'

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// Solo dígitos y un separador decimal. Bloquea letras y signo negativo al tipear.
function sanitizeMoney(raw: string): string {
  let clean = raw.replace(/[^\d.,]/g, '')
  const sep = clean.search(/[.,]/)
  if (sep !== -1) {
    clean = clean.slice(0, sep + 1) + clean.slice(sep + 1).replace(/[.,]/g, '')
  }
  return clean
}

function parseMoney(raw: string): number | null {
  const clean = raw.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')
  if (clean === '') return null
  const n = Number(clean)
  return Number.isFinite(n) ? n : null
}

function parsePercent(raw: string): number | null {
  const clean = raw.replace(/[^\d.,]/g, '').replace(',', '.')
  if (clean === '') return null
  const n = Number(clean)
  return Number.isFinite(n) ? n : null
}

const baseLabel: Record<'lista' | 'contado', string> = {
  lista: 'lista',
  contado: 'contado',
}

const CUOTAS_RAPIDAS = [3, 6, 10, 12, 18, 24]

export default function Calculadora() {
  const [precioListaRaw, setPrecioListaRaw] = useState('')
  const [precioContadoRaw, setPrecioContadoRaw] = useState('')
  const [condicionId, setCondicionId] = useState('')
  const [clienteEspecial, setClienteEspecial] = useState(false)
  const [masDeCinco, setMasDeCinco] = useState(false)
  const [tasaRaw, setTasaRaw] = useState('6')
  const [cuotas, setCuotas] = useState<number | null>(null)
  const [producto, setProducto] = useState('')

  const precioLista = useMemo(() => parseMoney(precioListaRaw), [precioListaRaw])
  const precioContado = useMemo(() => parseMoney(precioContadoRaw), [precioContadoRaw])
  const tasaPct = useMemo(() => parsePercent(tasaRaw), [tasaRaw])

  const esHaberes = useMemo(
    () => rules.find((r) => r.id === condicionId)?.haberes === true,
    [condicionId],
  )

  // Si la condición elegida ya no corresponde al precio cargado (ej. era de
  // contado y se borró ese precio), se deselecciona para no quedar inconsistente.
  useEffect(() => {
    if (!condicionId) return
    const r = rules.find((x) => x.id === condicionId)
    if (!r) return
    const okBase = r.base === 'lista' ? precioLista !== null : precioContado !== null
    if (!okBase) setCondicionId('')
  }, [condicionId, precioLista, precioContado])

  const result = useMemo(
    () =>
      calcularPrecio({
        precioLista,
        precioContado,
        condicionId: condicionId || null,
        clienteEspecial,
        masDeCinco,
        tasaMensualSindicato: esHaberes && tasaPct !== null ? tasaPct / 100 : null,
        cantidadCuotas: esHaberes ? cuotas : null,
      }),
    [precioLista, precioContado, condicionId, clienteEspecial, masDeCinco, esHaberes, tasaPct, cuotas],
  )

  function reset() {
    setPrecioListaRaw('')
    setPrecioContadoRaw('')
    setCondicionId('')
    setClienteEspecial(false)
    setMasDeCinco(false)
    setTasaRaw('6')
    setCuotas(null)
    setProducto('')
  }

  return (
    <main className="bg-slate-50 text-slate-900 antialiased transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex max-w-md flex-col px-5 pb-10 pt-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Calculadora de precios
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Cargá los datos y obtené el precio final.
          </p>
        </header>

        <div className="flex flex-col gap-5">
          <MoneyField
            id="precio-lista"
            label="Precio de lista"
            value={precioListaRaw}
            onChange={setPrecioListaRaw}
            parsed={precioLista}
          />

          <MoneyField
            id="precio-contado"
            label="Precio de contado"
            value={precioContadoRaw}
            onChange={setPrecioContadoRaw}
            parsed={precioContado}
          />

          <CondicionSelect
            value={condicionId}
            onChange={setCondicionId}
            options={rules.map((r) => ({
              id: r.id,
              label: r.label,
              base: r.base as 'lista' | 'contado',
              note: (r as { note?: string }).note,
              ...condColor(r),
            }))}
            hasLista={precioLista !== null}
            hasContado={precioContado !== null}
          />

          <HaberesPanel
            open={esHaberes}
            tasaRaw={tasaRaw}
            onTasaChange={setTasaRaw}
            tasaPct={tasaPct}
            cuotas={cuotas}
            onCuotasChange={setCuotas}
          />

          <Toggle
            label="Cliente especial"
            checked={clienteEspecial}
            onChange={setClienteEspecial}
          />
          <Toggle
            label="Más de 5 artículos"
            checked={masDeCinco}
            onChange={setMasDeCinco}
          />
        </div>

        <Resultado result={result} />

        {result.tipo === 'ok' && (
          <PdfPresupuesto producto={producto} onProducto={setProducto} result={result} />
        )}

        <button
          type="button"
          onClick={reset}
          className="mt-6 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white text-base font-medium text-slate-600 transition active:scale-[0.98] active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:active:bg-slate-800"
        >
          Limpiar todo
        </button>
      </div>
    </main>
  )
}

type Opcion = {
  id: string
  label: string
  base: 'lista' | 'contado'
  note?: string
  bg: string
  fg: string
}

// Color por categoría de condición. Prioridad: haberes > contado > lista.
function condColor(r: { base: string; haberes?: boolean }): { bg: string; fg: string } {
  if (r.haberes) return { bg: '#ffe5a0', fg: '#1c1917' }
  if (r.base === 'contado') return { bg: '#11734b', fg: '#ffffff' }
  return { bg: '#bfe1f6', fg: '#0f172a' }
}

function CondicionSelect({
  value,
  onChange,
  options,
  hasLista,
  hasContado,
}: {
  value: string
  onChange: (id: string) => void
  options: Opcion[]
  hasLista: boolean
  hasContado: boolean
}) {
  const [open, setOpen] = useState(false)
  // mounted controla el render; visible dispara la transición de entrada/salida.
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const seleccion = options.find((o) => o.id === value)

  // Sin precio: no se muestran opciones, solo un cartel. Con un solo precio, solo
  // las opciones de esa base. Con los dos, agrupadas (Lista aparte de Contado).
  const sinPrecio = !hasLista && !hasContado
  const opcLista = options.filter((o) => o.base === 'lista')
  const opcContado = options.filter((o) => o.base === 'contado')
  const grupos: { titulo?: string; items: Opcion[] }[] = sinPrecio
    ? []
    : hasLista && hasContado
      ? [
          { titulo: 'Lista', items: opcLista },
          { titulo: 'Contado', items: opcContado },
        ]
      : hasLista
        ? [{ items: opcLista }]
        : [{ items: opcContado }]

  // Abrir: montar, luego en el siguiente frame activar visible para animar.
  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(raf)
    }
    setVisible(false)
    const t = setTimeout(() => setMounted(false), 300)
    return () => clearTimeout(t)
  }, [open])

  // Cerrar con Escape + bloquear scroll del fondo mientras está abierto.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function elegir(id: string) {
    onChange(id)
    close()
  }

  return (
    <div className="flex flex-col gap-2">
      <span id="condicion-label" className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Condición de pago
      </span>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby="condicion-label"
        className="flex min-h-[52px] w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 text-left text-base text-slate-900 transition active:scale-[0.99] focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/25"
      >
        <span className={seleccion ? '' : 'text-slate-400 dark:text-slate-500'}>
          {seleccion ? seleccion.label : 'Elegí una condición…'}
        </span>
        <ChevronDownIcon className="shrink-0 text-slate-400 dark:text-slate-500" />
      </button>

      {mounted && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          {/* Scrim: oscurece + desenfoca el fondo durante la animación. */}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={close}
            className={`absolute inset-0 bg-slate-950/40 backdrop-blur-md transition-opacity duration-300 ease-out ${
              visible ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {/* Ventana / sheet con física spring al entrar. */}
          <div
            role="listbox"
            aria-labelledby="condicion-label"
            aria-activedescendant={value ? `opt-${value}` : undefined}
            className={`relative flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl border-t border-white/10 bg-white shadow-2xl transition-all duration-300 dark:bg-slate-900 sm:mx-4 sm:rounded-3xl sm:border ${
              visible
                ? 'translate-y-0 scale-100 opacity-100'
                : 'translate-y-6 scale-[0.97] opacity-0'
            }`}
            style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1.4, 0.36, 1)' }}
          >
            <div className="shrink-0 px-3 pt-3">
              <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700 sm:hidden" />
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Condición de pago
              </p>
            </div>
            {/* Solo la lista scrollea; barra oculta y forma intacta. */}
            {sinPrecio ? (
              <div className="px-3 pb-6 pt-3">
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-base font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                  Coloca un precio de lista o de contado.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {grupos.map((g, gi) => (
                  <div key={g.titulo ?? gi} className="flex flex-col gap-2">
                    {g.titulo && (
                      <p className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {g.titulo}
                      </p>
                    )}
                    {g.items.map((o) => {
                      const active = o.id === value
                      return (
                        <button
                          key={o.id}
                          id={`opt-${o.id}`}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => elegir(o.id)}
                          style={{ backgroundColor: o.bg, color: o.fg }}
                          className={`flex min-h-[52px] w-full flex-col items-start justify-center gap-0.5 rounded-xl px-4 py-2 text-left text-base font-medium shadow-sm transition active:scale-[0.99] ${
                            active ? 'ring-2 ring-slate-900/50 dark:ring-white/70' : ''
                          }`}
                        >
                          <span className="flex w-full items-center justify-between gap-3">
                            <span>{o.label}</span>
                            {active && <CheckIcon className="shrink-0" />}
                          </span>
                          {o.note && (
                            <span className="text-xs font-semibold leading-snug opacity-80">
                              {o.note}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MoneyField({
  id,
  label,
  value,
  onChange,
  parsed,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  parsed: number | null
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-slate-400 dark:text-slate-500">
          $
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          value={value}
          onChange={(e) => onChange(sanitizeMoney(e.target.value))}
          className="min-h-[52px] w-full rounded-xl border border-slate-200 bg-white pl-8 pr-4 text-base tabular-nums text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/25"
        />
      </div>
      {parsed !== null && (
        <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">{pesos.format(parsed)}</span>
      )}
    </div>
  )
}

function HaberesPanel({
  open,
  tasaRaw,
  onTasaChange,
  tasaPct,
  cuotas,
  onCuotasChange,
}: {
  open: boolean
  tasaRaw: string
  onTasaChange: (v: string) => void
  tasaPct: number | null
  cuotas: number | null
  onCuotasChange: (v: number | null) => void
}) {
  return (
    <div
      className={`grid transition-all duration-300 ease-out ${
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
      aria-hidden={!open}
    >
      <div className="overflow-hidden">
        <div className="flex flex-col gap-5 rounded-xl border-l-2 border-emerald-600 bg-emerald-50/60 py-5 pl-4 pr-4 dark:border-emerald-500 dark:bg-emerald-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Descuento de haberes
          </p>

          <div className="flex flex-col gap-2">
            <label htmlFor="tasa-sindicato" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Tasa mensual del sindicato
            </label>
            <div className="relative">
              <input
                id="tasa-sindicato"
                inputMode="decimal"
                autoComplete="off"
                placeholder="6"
                value={tasaRaw}
                disabled={!open}
                onChange={(e) => onTasaChange(e.target.value)}
                className="min-h-[52px] w-full rounded-xl border border-slate-200 bg-white pl-4 pr-9 text-base tabular-nums text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/25"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-base text-slate-400 dark:text-slate-500">
                %
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {tasaPct !== null
                ? `Interés simple del ${tasaPct.toLocaleString('es-AR')}% por cuota.`
                : 'Ingresá la tasa que retiene el sindicato cada mes.'}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Cantidad de cuotas</span>
            <div className="flex flex-wrap gap-2">
              {CUOTAS_RAPIDAS.map((n) => {
                const active = cuotas === n
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={!open}
                    onClick={() => onCuotasChange(n)}
                    aria-pressed={active}
                    className={`min-h-[44px] min-w-[44px] flex-1 rounded-xl border px-3 text-base font-semibold tabular-nums transition active:scale-[0.97] ${
                      active
                        ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950'
                        : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
            <CuotasInput value={cuotas} onChange={onCuotasChange} disabled={!open} />
          </div>
        </div>
      </div>
    </div>
  )
}

function CuotasInput({
  value,
  onChange,
  disabled,
}: {
  value: number | null
  onChange: (v: number | null) => void
  disabled: boolean
}) {
  return (
    <div className="relative">
      <input
        id="cantidad-cuotas"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Otra cantidad"
        value={value === null ? '' : value}
        disabled={disabled}
        onChange={(e) => {
          const soloNumeros = e.target.value.replace(/\D/g, '')
          onChange(soloNumeros === '' ? null : Number(soloNumeros))
        }}
        aria-label="Cantidad de cuotas"
        className="min-h-[52px] w-full rounded-xl border border-slate-200 bg-white pl-4 pr-16 text-base tabular-nums text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/25"
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500">
        {value === 1 ? 'cuota' : 'cuotas'}
      </span>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-[52px] w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-left dark:border-slate-700 dark:bg-slate-900"
    >
      <span className="text-base font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  )
}

function Resultado({ result }: { result: ReturnType<typeof calcularPrecio> }) {
  if (result.tipo === 'ale') {
    return (
      <div className="mt-8 rounded-2xl border-t-4 border-red-600 bg-red-50 px-6 py-10 text-center dark:border-red-500 dark:bg-red-500/10">
        <p className="text-3xl font-extrabold tracking-tight text-red-700 dark:text-red-400">PREGUNTAR A ALE</p>
      </div>
    )
  }

  if (result.tipo === 'falta_condicion') {
    return (
      <div className="mt-8 px-2 py-10 text-center">
        <p className="text-base text-slate-400 dark:text-slate-500">Elegí condición de pago</p>
      </div>
    )
  }

  if (result.tipo === 'falta_precio') {
    return (
      <div className="mt-8 px-2 py-10 text-center">
        <p className="text-base text-slate-400 dark:text-slate-500">Cargá el precio de {baseLabel[result.cual]}</p>
      </div>
    )
  }

  if (result.tipo === 'falta_datos_haberes') {
    return (
      <div className="mt-8 px-2 py-10 text-center">
        <p className="text-base text-slate-400 dark:text-slate-500">
          {result.cual === 'tasa' ? 'Ingresá la tasa del sindicato' : 'Elegí la cantidad de cuotas'}
        </p>
      </div>
    )
  }

  if (result.tipo === 'regla_no_encontrada') {
    return (
      <div className="mt-8 px-2 py-10 text-center">
        <p className="text-base text-slate-400 dark:text-slate-500">Condición inválida</p>
      </div>
    )
  }

  const factorPct = `${(result.factor * 100).toLocaleString('es-AR', {
    maximumFractionDigits: 2,
  })}%`

  if ('cuotas' in result) {
    const interesPct = ((result.factor - 1) * 100).toLocaleString('es-AR', {
      maximumFractionDigits: 2,
    })
    const tasaPct = (result.tasaMensual * 100).toLocaleString('es-AR')
    const factorNum = result.factor.toLocaleString('es-AR', { maximumFractionDigits: 4 })
    return (
      <div className="mt-8 rounded-2xl border-t-4 border-emerald-600 bg-white px-6 py-8 dark:border-emerald-500 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {result.cuotas} cuotas de
          </p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight text-slate-900 dark:text-slate-50">
            {pesos.format(result.precioPorCuota)}
          </p>
        </div>
        <dl className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 text-sm dark:border-slate-800">
          <Row label="Total a pagar" value={pesos.format(result.precio)} strong />
          <Row label="Interés total" value={`+${interesPct}%`} />
          <Row label="Tasa mensual" value={`${tasaPct}%`} />
          <Row label="Factor aplicado" value={factorPct} />
        </dl>
        <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-5 text-base dark:border-slate-800">
          <Formula
            label="Interés total"
            calc={`${tasaPct}% × ${result.cuotas} cuotas = ${interesPct}%`}
          />
          <Formula label="Tasa mensual" calc={`${tasaPct}% que retiene el sindicato`} />
          <Formula label="Factor aplicado" calc={`1 + ${interesPct}% = ${factorNum} (${factorPct})`} />
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 rounded-2xl border-t-4 border-emerald-600 bg-white px-6 py-8 text-center dark:border-emerald-500 dark:bg-slate-900">
      {result.cuotasFijas && result.precioPorCuota !== undefined && (
        <p className="mb-3 text-xl font-medium text-slate-500 dark:text-slate-400">
          {result.cuotasFijas} cuotas de{' '}
          <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {pesos.format(result.precioPorCuota)}
          </span>
        </p>
      )}
      <p className="text-4xl font-extrabold tabular-nums tracking-tight text-slate-900 dark:text-slate-50">
        {pesos.format(result.precio)}
      </p>
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
        Precio de {baseLabel[result.base]} × {factorPct} = {pesos.format(result.precio)}
      </p>
    </div>
  )
}

/* ---------- PDF / Presupuesto para el cliente ---------- */

type OkResult = Extract<CalcResult, { tipo: 'ok' }>

interface DatosPago {
  modalidad: string
  cuotas?: number
  porCuota?: number
  total: number
}

/** Extrae SOLO lo que ve el cliente: modalidad y montos. Nada de factores ni tasas. */
function datosPago(result: OkResult): DatosPago {
  const total = result.precio
  if ('cuotas' in result) {
    return { modalidad: result.regla, cuotas: result.cuotas, porCuota: result.precioPorCuota, total }
  }
  if (result.cuotasFijas && result.precioPorCuota !== undefined) {
    return { modalidad: result.regla, cuotas: result.cuotasFijas, porCuota: result.precioPorCuota, total }
  }
  return { modalidad: result.regla, total }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** HTML autocontenido del presupuesto, pensado para imprimir / guardar como PDF. */
function presupuestoHTML(producto: string, d: DatosPago): string {
  const fecha = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const nombre = producto.trim() || 'Producto'

  const detalle = d.cuotas
    ? `
      <tr><th>Modalidad de pago</th><td>${escapeHtml(d.modalidad)}</td></tr>
      <tr><th>Cuotas</th><td>${d.cuotas} cuotas de <strong>${pesos.format(d.porCuota ?? 0)}</strong></td></tr>
      <tr class="total"><th>Total</th><td>${pesos.format(d.total)}</td></tr>`
    : `
      <tr><th>Modalidad de pago</th><td>${escapeHtml(d.modalidad)}</td></tr>
      <tr class="total"><th>Precio final</th><td>${pesos.format(d.total)}</td></tr>`

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Presupuesto - ${escapeHtml(nombre)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; }
    .doc { max-width: 620px; margin: 0 auto; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #059669; padding-bottom: 16px; }
    .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #059669; }
    .brand small { display:block; font-size: 12px; font-weight: 600; color:#64748b; letter-spacing: 0; }
    .fecha { font-size: 13px; color: #64748b; text-align: right; }
    h1 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.08em; color:#64748b; margin: 28px 0 4px; }
    .prod { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 24px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 12px 4px; border-bottom: 1px solid #e2e8f0; font-size: 15px; }
    th { color: #64748b; font-weight: 600; width: 45%; }
    td { text-align: right; font-variant-numeric: tabular-nums; }
    tr.total th, tr.total td { font-size: 22px; font-weight: 800; color: #059669; border-bottom: none; padding-top: 18px; }
    .pie { margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: center; }
    @media print { body { padding: 0; } .doc { max-width: none; } }
  </style></head>
  <body><div class="doc">
    <div class="head">
      <div class="brand">MG Hogar<small>Presupuesto</small></div>
      <div class="fecha">Fecha<br>${fecha}</div>
    </div>
    <h1>Producto</h1>
    <p class="prod">${escapeHtml(nombre)}</p>
    <table><tbody>${detalle}</tbody></table>
    <p class="pie">Presupuesto sin compromiso. Precios sujetos a cambios.</p>
  </div>
  <script>window.onload = function () { window.focus(); window.print(); }</script>
  </body></html>`
}

/** Abre el presupuesto en un iframe oculto y dispara el diálogo de impresión / PDF. */
function generarPDF(producto: string, result: OkResult) {
  const html = presupuestoHTML(producto, datosPago(result))
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.srcdoc = html
  iframe.onload = () => {
    // El diálogo bloquea; al cerrarlo, limpiamos el iframe.
    window.setTimeout(() => iframe.remove(), 60000)
  }
  document.body.appendChild(iframe)
}

function PdfPresupuesto({
  producto,
  onProducto,
  result,
}: {
  producto: string
  onProducto: (v: string) => void
  result: OkResult
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Presupuesto para el cliente
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Ponele el nombre del producto y generá un PDF limpio (sin criterios internos).
        </span>
      </div>
      <input
        id="nombre-producto"
        type="text"
        autoComplete="off"
        placeholder="Nombre del producto (ej: Heladera Whirlpool 375L)"
        value={producto}
        onChange={(e) => onProducto(e.target.value)}
        className="min-h-[52px] w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/25"
      />
      <button
        type="button"
        onClick={() => generarPDF(producto, result)}
        disabled={!producto.trim()}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-base font-bold text-white transition active:scale-[0.98] disabled:opacity-40 dark:bg-emerald-500 dark:text-slate-950"
      >
        <PdfIcon />
        Generar PDF
      </button>
    </div>
  )
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 15h6M9 18h4" />
    </svg>
  )
}

function Formula({ label, calc }: { label: string; calc: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <span className="tabular-nums text-slate-700 dark:text-slate-300">{calc}</span>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        className={`tabular-nums ${
          strong ? 'text-lg font-bold text-slate-900 dark:text-slate-50' : 'font-medium text-slate-700 dark:text-slate-300'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

/* Íconos inline (sin dependencias, sin emojis), trazo 1.5 consistente. */
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
