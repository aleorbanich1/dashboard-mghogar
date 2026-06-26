// POST /api/precio  (Netlify Function)
// Conecta ManyChat con LA LÓGICA de precios diferenciados.
// Recibe método de pago + precios → devuelve el precio diferenciado.
//
// Auth: header  Authorization: Bearer <API_TOKEN>   (o  x-api-key: <API_TOKEN>)
//
// Body (JSON):
// {
//   "condicionId":   "r10",        // id de la condición  (ver /api/condiciones)
//   "metodo":        "efectivo",   // alternativa: nombre del método (alias)
//   "precioLista":   125000,
//   "precioContado": 100000,
//   "clienteEspecial": false,
//   "masDeCinco":      false,
//   "tasaMensual":     6,          // % mensual sindicato (solo descuento de haberes)
//   "cuotas":          10          // solo descuento de haberes
// }

import { calcularPrecio } from '../../src/lib/calc'
import rules from '../../src/data/rules.json'
import { authorize, json, preflight } from './_lib/api'

// Alias de texto libre → id de regla, para que el flujo de ManyChat pueda mandar
// el método "hablado" por el cliente sin conocer los ids internos.
const ALIAS: Record<string, string> = {
  'tarjeta credito': 'r05',
  'tarjeta de credito': 'r05',
  'credito': 'r05',
  'haberes': 'r06',
  'descuento de haberes': 'r06',
  'transferencia 60': 'r07',
  'cheque 60': 'r08',
  'cheque 90': 'r09',
  'efectivo con factura': 'r10',
  'efectivo factura': 'r10',
  'efectivo': 'r11',
  'efectivo sin factura': 'r11',
  'transferencia': 'r12',
  'transferencia 7': 'r12',
  'debito': 'r13',
  'tarjeta debito': 'r13',
  'tarjeta de debito': 'r13',
  'cheque 30': 'r14',
  'cheque': 'r14',
}

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// Acepta number | "125000" | "125.000,50" → number | null.
function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const clean = v.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')
    if (clean === '') return null
    const n = Number(clean)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function bool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1' || v === 'si' || v === 'sí'
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

// Resuelve condicionId desde condicionId explícito o desde "metodo" (alias o label).
function resolverCondicion(body: Record<string, unknown>): string | null {
  const explicit = body.condicionId
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim()

  const metodo = body.metodo
  if (typeof metodo !== 'string' || !metodo.trim()) return null
  const key = normalize(metodo)

  if (ALIAS[key]) return ALIAS[key]
  const porLabel = (rules as { id: string; label: string }[]).find(
    (r) => normalize(r.label) === key,
  )
  return porLabel ? porLabel.id : null
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Usar POST' }, 405)
  }

  const denied = authorize(req)
  if (denied) return denied

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json({ ok: false, error: 'JSON inválido en el body' }, 400)
  }

  const condicionId = resolverCondicion(body)
  const tasaRaw = num(body.tasaMensual ?? body.tasaSindicato)
  // Acepta tasa como % (6) o como decimal (0.06).
  const tasaMensual = tasaRaw == null ? null : tasaRaw > 1 ? tasaRaw / 100 : tasaRaw

  const result = calcularPrecio({
    precioLista: num(body.precioLista),
    precioContado: num(body.precioContado),
    condicionId,
    clienteEspecial: bool(body.clienteEspecial),
    masDeCinco: bool(body.masDeCinco),
    tasaMensualSindicato: tasaMensual,
    cantidadCuotas: num(body.cuotas),
  })

  // Mapeo del resultado de LA LÓGICA → respuesta amigable para el flujo de ManyChat.
  switch (result.tipo) {
    case 'ale':
      return json({
        ok: true,
        estado: 'consultar',
        mensaje:
          'Este caso (cliente especial o más de 5 artículos) requiere consultar a Ale para definir el precio.',
      })

    case 'falta_condicion':
      return json(
        {
          ok: false,
          estado: 'falta_condicion',
          mensaje:
            'Falta el método de pago. Enviá "condicionId" o "metodo". Ver /api/condiciones.',
        },
        422,
      )

    case 'regla_no_encontrada':
      return json(
        {
          ok: false,
          estado: 'metodo_invalido',
          mensaje: 'El método de pago no existe. Ver /api/condiciones.',
        },
        422,
      )

    case 'falta_precio':
      return json(
        {
          ok: false,
          estado: 'falta_precio',
          mensaje: `Falta el precio de ${result.cual} para este método de pago.`,
          cual: result.cual,
        },
        422,
      )

    case 'falta_datos_haberes':
      return json(
        {
          ok: false,
          estado: 'falta_datos_haberes',
          mensaje:
            result.cual === 'tasa'
              ? 'Descuento de haberes: falta la tasa mensual del sindicato ("tasaMensual").'
              : 'Descuento de haberes: falta la cantidad de cuotas ("cuotas").',
          cual: result.cual,
        },
        422,
      )

    case 'ok': {
      const base = {
        ok: true as const,
        estado: 'ok' as const,
        condicionId,
        condicion: result.regla,
        baseUsada: result.base,
        factor: result.factor,
        precio: Math.round(result.precio * 100) / 100,
        precioFormateado: pesos.format(result.precio),
      }

      if ('cuotas' in result) {
        return json({
          ...base,
          cuotas: result.cuotas,
          precioPorCuota: Math.round(result.precioPorCuota * 100) / 100,
          precioPorCuotaFormateado: pesos.format(result.precioPorCuota),
          tasaMensual: result.tasaMensual,
          mensaje: `${result.regla}: ${result.cuotas} cuotas de ${pesos.format(
            result.precioPorCuota,
          )} (total ${pesos.format(result.precio)}).`,
        })
      }

      if (result.cuotasFijas && result.precioPorCuota !== undefined) {
        return json({
          ...base,
          cuotas: result.cuotasFijas,
          precioPorCuota: Math.round(result.precioPorCuota * 100) / 100,
          precioPorCuotaFormateado: pesos.format(result.precioPorCuota),
          mensaje: `${result.regla}: ${result.cuotasFijas} cuotas de ${pesos.format(
            result.precioPorCuota,
          )} (total ${pesos.format(result.precio)}).`,
        })
      }

      return json({
        ...base,
        mensaje: `${result.regla}: ${pesos.format(result.precio)}.`,
      })
    }
  }
}

// Netlify: ruta limpia /api/precio (en vez de /.netlify/functions/precio).
export const config = { path: '/api/precio' }
