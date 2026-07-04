import rules from '../data/rules.json'

interface Regla {
  id: string
  label: string
  base: 'lista' | 'contado'
  factor: number
  /** Marca la condición "Descuento de haberes": factor dinámico por interés simple. */
  haberes?: boolean
  /** Cantidad de cuotas fijas de la condición (ej. "Lista 9 cuotas"). */
  cuotas?: number
  /** Nota/aclaración que se muestra en el selector (ej. cuándo aplicar el descuento). */
  note?: string
}

export interface CalcInput {
  precioLista: number | null | undefined
  precioContado: number | null | undefined
  condicionId: string | null | undefined
  clienteEspecial: boolean
  masDeCinco: boolean
  /** Retención mensual del sindicato (ej. 0.06 = 6%). Solo para descuento de haberes. */
  tasaMensualSindicato?: number | null
  /** Cantidad de cuotas. Solo para descuento de haberes. */
  cantidadCuotas?: number | null
}

export type CalcResult =
  | { tipo: 'ale' }
  | { tipo: 'falta_condicion' }
  | { tipo: 'falta_precio'; cual: 'lista' | 'contado' }
  | { tipo: 'falta_datos_haberes'; cual: 'tasa' | 'cuotas' }
  | { tipo: 'regla_no_encontrada' }
  | {
      tipo: 'ok'
      precio: number
      regla: string
      base: 'lista' | 'contado'
      factor: number
      // Cuotas fijas de la condición (ej. "Lista 9 cuotas"), si aplica.
      cuotasFijas?: number
      precioPorCuota?: number
    }
  | {
      tipo: 'ok'
      precio: number
      regla: string
      base: 'lista'
      factor: number
      // Desglose interés simple (descuento de haberes)
      tasaMensual: number
      cuotas: number
      precioPorCuota: number
    }

export function calcularPrecio(input: CalcInput): CalcResult {
  const {
    precioLista,
    precioContado,
    condicionId,
    clienteEspecial,
    masDeCinco,
    tasaMensualSindicato,
    cantidadCuotas,
  } = input

  if (clienteEspecial || masDeCinco) {
    return { tipo: 'ale' }
  }

  if (!condicionId) {
    return { tipo: 'falta_condicion' }
  }

  const regla = (rules as Regla[]).find((r) => r.id === condicionId)
  if (!regla) {
    return { tipo: 'regla_no_encontrada' }
  }

  const base = regla.base
  const precioBase = base === 'lista' ? precioLista : precioContado

  if (!precioBase) {
    return { tipo: 'falta_precio', cual: base }
  }

  // Descuento de haberes: interés simple sobre el precio de lista.
  // Precio = lista × (1 + tasa mensual × cuotas). No es un factor fijo de tabla.
  if (regla.haberes) {
    if (!tasaMensualSindicato) {
      return { tipo: 'falta_datos_haberes', cual: 'tasa' }
    }
    if (!cantidadCuotas) {
      return { tipo: 'falta_datos_haberes', cual: 'cuotas' }
    }

    const factor = 1 + tasaMensualSindicato * cantidadCuotas
    const precio = precioBase * factor

    return {
      tipo: 'ok',
      precio,
      regla: regla.label,
      base: 'lista',
      factor,
      tasaMensual: tasaMensualSindicato,
      cuotas: cantidadCuotas,
      precioPorCuota: precio / cantidadCuotas,
    }
  }

  const precio = precioBase * regla.factor

  return {
    tipo: 'ok',
    precio,
    regla: regla.label,
    base,
    factor: regla.factor,
    ...(regla.cuotas && regla.cuotas > 1
      ? { cuotasFijas: regla.cuotas, precioPorCuota: precio / regla.cuotas }
      : {}),
  }
}
