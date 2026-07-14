/**
 * Capa de datos de "Registro de calendarios": el seguimiento de los contactos
 * de la cartera de clientes (a quién se contactó, qué día, de qué segmento, en
 * qué estado quedó y qué pasó en la charla).
 *
 * Replica la base de Notion "Calendario de contactos" en Supabase (tabla
 * `calendarios`), compartida por todo el equipo. El SQL está en
 * supabase/calendarios.sql.
 */

import { supabase } from './supabase'

/** Estados posibles del contacto (lista cerrada para poder contar). */
export const ESTADOS = ['Pendiente', 'Enviado'] as const
export type Estado = (typeof ESTADOS)[number]

/** Segmentos usados por el negocio. Se pueden escribir otros: es texto libre. */
export const SEGMENTOS_SUGERIDOS = [
  'Gama alta otoño/invierno',
  'Gama media otoño/invierno',
  'Gama baja otoño/invierno',
  'Gama alta primavera/verano',
  'Gama media primavera/verano',
  'Gama baja primavera/verano',
]

export interface Contacto {
  id: string
  nombre: string
  /** 'YYYY-MM-DD' — el día en que se contactó. */
  dia: string
  segmento: string
  notas: string
  estado: string
  /** Número de WhatsApp, tal como se carga (sin normalizar). */
  wsp: string
}

/** Campos editables de un contacto (todo menos el id). */
export type ContactoInput = Omit<Contacto, 'id'>

interface ContactoRow {
  id: string
  nombre: string | null
  dia: string | null
  segmento: string | null
  notas: string | null
  estado: string | null
  wsp: string | null
}

const COLUMNAS = 'id, nombre, dia, segmento, notas, estado, wsp'

function mapRow(row: ContactoRow): Contacto {
  return {
    id: row.id,
    nombre: row.nombre ?? '',
    dia: row.dia ?? '',
    segmento: row.segmento ?? '',
    notas: row.notas ?? '',
    estado: row.estado ?? 'Pendiente',
    wsp: row.wsp ?? '',
  }
}

/** Fila nueva vacía, con el día de hoy y estado Pendiente. */
export function contactoVacio(): ContactoInput {
  const hoy = new Date()
  const dia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  return { nombre: '', dia, segmento: '', notas: '', estado: 'Pendiente', wsp: '' }
}

/** Trae todos los contactos, del más reciente al más viejo. */
export async function loadContactos(): Promise<Contacto[]> {
  const { data, error } = await supabase
    .from('calendarios')
    .select(COLUMNAS)
    .order('dia', { ascending: false })

  if (error) {
    console.error('Error cargando contactos:', error.message)
    throw new Error(error.message)
  }
  return (data as ContactoRow[]).map(mapRow)
}

/** Crea una fila y devuelve el contacto ya con su id. */
export async function addContacto(input: ContactoInput): Promise<Contacto> {
  const { data, error } = await supabase
    .from('calendarios')
    .insert({ ...input, dia: input.dia || null })
    .select(COLUMNAS)
    .single()

  if (error) {
    console.error('Error creando contacto:', error.message)
    throw new Error(error.message)
  }
  return mapRow(data as ContactoRow)
}

/** Guarda los cambios de una fila. */
export async function updateContacto(id: string, input: ContactoInput): Promise<Contacto> {
  const { data, error } = await supabase
    .from('calendarios')
    .update({ ...input, dia: input.dia || null })
    .eq('id', id)
    .select(COLUMNAS)
    .single()

  if (error) {
    console.error('Error guardando contacto:', error.message)
    throw new Error(error.message)
  }
  return mapRow(data as ContactoRow)
}

export async function deleteContacto(id: string): Promise<void> {
  const { error } = await supabase.from('calendarios').delete().eq('id', id)
  if (error) {
    console.error('Error borrando contacto:', error.message)
    throw new Error(error.message)
  }
}

/**
 * Filtra los contactos de un rango de fechas (inclusive). Con `desde`/`hasta`
 * vacíos devuelve todo — es el modo "Todo" del botón Enviar resultados.
 *
 * Las filas sin día quedan fuera de un rango (no se puede ubicar en el tiempo)
 * pero sí entran en "Todo".
 */
export function filtrarPorRango(contactos: Contacto[], desde: string, hasta: string): Contacto[] {
  if (!desde && !hasta) return contactos
  // Si el usuario invierte las fechas, se ordenan solas.
  const lo = desde && hasta ? (desde <= hasta ? desde : hasta) : desde
  const hi = desde && hasta ? (desde <= hasta ? hasta : desde) : hasta
  return contactos.filter((c) => {
    if (!c.dia) return false
    if (lo && c.dia < lo) return false
    if (hi && c.dia > hi) return false
    return true
  })
}

/* ---------- Orden ---------- */

export type Orden = 'fecha_desc' | 'fecha_asc' | 'segmento' | 'estado' | 'nombre'

export const ORDENES: { id: Orden; label: string }[] = [
  { id: 'fecha_desc', label: 'Más recientes' },
  { id: 'fecha_asc', label: 'Más antiguos' },
  { id: 'segmento', label: 'Segmento' },
  { id: 'estado', label: 'Estado' },
  { id: 'nombre', label: 'Nombre' },
]

/** Pendiente primero: es lo que falta hacer. */
const PESO_ESTADO: Record<string, number> = { Pendiente: 0, Enviado: 1 }

const porNombre = (a: Contacto, b: Contacto) => a.nombre.localeCompare(b.nombre, 'es')

/** Las filas sin día van al final en cualquier orden por fecha. */
function porFecha(a: Contacto, b: Contacto, desc: boolean): number {
  if (!a.dia && !b.dia) return porNombre(a, b)
  if (!a.dia) return 1
  if (!b.dia) return -1
  const cmp = a.dia.localeCompare(b.dia)
  return desc ? -cmp : cmp
}

/** Ordena sin mutar la lista original. Empates: se desempata por nombre. */
export function ordenar(contactos: Contacto[], orden: Orden): Contacto[] {
  const lista = [...contactos]
  switch (orden) {
    case 'fecha_asc':
      return lista.sort((a, b) => porFecha(a, b, false))
    case 'segmento':
      return lista.sort(
        (a, b) => a.segmento.localeCompare(b.segmento, 'es') || porFecha(a, b, true)
      )
    case 'estado':
      return lista.sort(
        (a, b) =>
          (PESO_ESTADO[a.estado] ?? 99) - (PESO_ESTADO[b.estado] ?? 99) || porFecha(a, b, true)
      )
    case 'nombre':
      return lista.sort(porNombre)
    case 'fecha_desc':
    default:
      return lista.sort((a, b) => porFecha(a, b, true))
  }
}

/** Totales para el encabezado del PDF. */
export function resumen(contactos: Contacto[]): { estado: string; cantidad: number }[] {
  const cuenta = new Map<string, number>()
  for (const c of contactos) {
    const e = c.estado || 'Sin estado'
    cuenta.set(e, (cuenta.get(e) ?? 0) + 1)
  }
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([estado, cantidad]) => ({ estado, cantidad }))
}
