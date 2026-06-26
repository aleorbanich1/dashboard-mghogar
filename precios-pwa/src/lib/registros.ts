/**
 * Capa de datos de Clientes. Persiste en Supabase (tablas `registros` y
 * `categorias_producto`), compartido en tiempo real entre todos los empleados.
 *
 * La UI (pages/Clientes.tsx) consume estas funciones de forma asíncrona.
 * El esquema de tablas y políticas está en supabase/schema.sql.
 */

import { supabase } from './supabase'
import type { VisitTypeId } from '../data/clientes'

export interface Registro {
  id: string
  ts: number // epoch ms (derivado de created_at)
  visit: VisitTypeId
  demand: string | null // nombre de categoría pedida sin stock, o null
}

// Fila tal como vuelve de Supabase.
interface RegistroRow {
  id: string
  created_at: string
  visit: VisitTypeId
  demand: string | null
}

function mapRow(row: RegistroRow): Registro {
  return {
    id: row.id,
    ts: new Date(row.created_at).getTime(),
    visit: row.visit,
    demand: row.demand,
  }
}

/** Trae todos los registros, del más viejo al más nuevo. */
export async function loadRegistros(): Promise<Registro[]> {
  const { data, error } = await supabase
    .from('registros')
    .select('id, created_at, visit, demand')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error cargando registros:', error.message)
    return []
  }
  return (data as RegistroRow[]).map(mapRow)
}

/** Inserta un registro y devuelve la lista completa actualizada. */
export async function addRegistro(input: {
  visit: VisitTypeId
  demand: string | null
}): Promise<Registro[]> {
  const { error } = await supabase
    .from('registros')
    .insert({ visit: input.visit, demand: input.demand })

  if (error) {
    console.error('Error guardando registro:', error.message)
    throw new Error(error.message)
  }
  return loadRegistros()
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
