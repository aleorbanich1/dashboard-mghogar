/**
 * Gráficos sin dependencias: barras horizontales accesibles.
 * Pensadas para móvil (las barras horizontales no se aprietan como las verticales).
 */

export interface BarDatum {
  label: string
  value: number
  color: string
}

export function BarChart({
  data,
  unit = '',
  emptyHint,
}: {
  data: BarDatum[]
  unit?: string
  emptyHint?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const max = Math.max(1, ...data.map((d) => d.value))

  if (total === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
        {emptyHint ?? 'Todavía no hay datos para mostrar.'}
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3" role="list">
      {data.map((d) => {
        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
        const w = (d.value / max) * 100
        return (
          <li key={d.label} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">{d.label}</span>
              <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{d.value}</span>
                {unit && ` ${unit}`} · {pct}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${w}%`,
                  backgroundColor: d.color,
                  transitionTimingFunction: 'cubic-bezier(0.22, 1.4, 0.36, 1)',
                }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
