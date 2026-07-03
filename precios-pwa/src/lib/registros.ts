/**
 * Capa de datos de Clientes. Persiste en Supabase (tablas `registros` y
 * `categorias_producto`), compartido en tiempo real entre todos los empleados.
 *
 * La UI (pages/Clientes.tsx) consume estas funciones de forma asíncrona.
 * El esquema de tablas y políticas está en supabase/schema.sql.
 */

import { supabase } from './supabase'

export interface Registro {
  id: string
  ts: number // epoch ms (derivado de created_at)
  // Id fijo (ver VISIT_TYPES) o el nombre de un tipo personalizado (tipos_visita).
  visit: string
  demand: string | null // nombre de categoría pedida sin stock, o null
  userId: string | null // empleado que atendió (registros.user_id), o null
  ventaAdicional: boolean // se llevó algo más (solo si compró)
  esHabitual: boolean | null // true = habitual, false = nuevo, null = sin especificar
  factura: boolean | null // true = con factura, false = sin factura, null = sin especificar
}

// Fila tal como vuelve de Supabase.
interface RegistroRow {
  id: string
  created_at: string
  visit: string
  demand: string | null
  user_id: string | null
  venta_adicional: boolean
  es_habitual: boolean | null
  factura: boolean | null
}

function mapRow(row: RegistroRow): Registro {
  return {
    id: row.id,
    ts: new Date(row.created_at).getTime(),
    visit: row.visit,
    demand: row.demand,
    userId: row.user_id,
    ventaAdicional: row.venta_adicional ?? false,
    esHabitual: row.es_habitual ?? null,
    factura: row.factura ?? null,
  }
}

/** Trae todos los registros, del más viejo al más nuevo. */
export async function loadRegistros(): Promise<Registro[]> {
  const { data, error } = await supabase
    .from('registros')
    .select('id, created_at, visit, demand, user_id, venta_adicional, es_habitual, factura')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error cargando registros:', error.message)
    return []
  }
  return (data as RegistroRow[]).map(mapRow)
}

/** Inserta un registro y devuelve la lista completa actualizada. */
export async function addRegistro(input: {
  visit: string
  demand: string | null
  userId: string | null
  ventaAdicional: boolean
  esHabitual: boolean | null
  factura: boolean | null
}): Promise<Registro[]> {
  const { error } = await supabase.from('registros').insert({
    visit: input.visit,
    demand: input.demand,
    user_id: input.userId,
    venta_adicional: input.ventaAdicional,
    es_habitual: input.esHabitual,
    factura: input.factura,
  })

  if (error) {
    console.error('Error guardando registro:', error.message)
    throw new Error(error.message)
  }
  return loadRegistros()
}

/* ---------- Equipo (empleados) ---------- */

export interface Empleado {
  id: string
  nombre: string
}

/**
 * Lista el equipo para el desplegable de "quién atendió".
 * Usa la función listar_empleados() (SECURITY DEFINER): expone solo id + nombre,
 * nunca el password.
 */
export async function loadEmpleados(): Promise<Empleado[]> {
  const { data, error } = await supabase.rpc('listar_empleados')

  if (error) {
    console.error('Error cargando empleados:', error.message)
    return []
  }
  return (data as Empleado[]) ?? []
}

/* ---------- Tipos de visita personalizados ---------- */

/** Tipos de cliente que cargó el negocio, más allá de los 4 fijos. */
export async function loadCustomVisitTypes(): Promise<string[]> {
  const { data, error } = await supabase
    .from('tipos_visita')
    .select('nombre')
    .order('nombre', { ascending: true })

  if (error) {
    console.error('Error cargando tipos de visita:', error.message)
    return []
  }
  return (data as { nombre: string }[]).map((t) => t.nombre)
}

/**
 * Agrega un tipo de visita personalizado al catálogo único y devuelve la lista
 * actualizada. Mismo patrón que addCategory: ignora vacíos y duplicados.
 */
export async function addVisitType(raw: string): Promise<string[]> {
  const name = raw.trim()
  if (!name) return loadCustomVisitTypes()

  const { error } = await supabase.from('tipos_visita').insert({ nombre: name })

  // 23505 = unique_violation: ya existía, no es un error real.
  if (error && error.code !== '23505') {
    console.error('Error agregando tipo de visita:', error.message)
    throw new Error(error.message)
  }
  return loadCustomVisitTypes()
}

/** Catálogo completo de categorías (orden alfabético, sin duplicados). */
export async function loadAllCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('categorias_producto')
    .select('nombre')
    .order('nombre', { ascending: true })

  if (error) {
    console.error('Error cargando categorías:', error.message)
    return []
  }
  return (data as { nombre: string }[]).map((c) => c.nombre)
}

/**
 * Agrega una categoría al catálogo único y devuelve el catálogo actualizado.
 * Ignora vacíos; los duplicados los bloquea la restricción UNIQUE de la tabla.
 */
export async function addCategory(raw: string): Promise<string[]> {
  const name = raw.trim()
  if (!name) return loadAllCategories()

  const { error } = await supabase
    .from('categorias_producto')
    .insert({ nombre: name })

  // 23505 = unique_violation: la categoría ya existía, no es un error real.
  if (error && error.code !== '23505') {
    console.error('Error agregando categoría:', error.message)
    throw new Error(error.message)
  }
  return loadAllCategories()
}
