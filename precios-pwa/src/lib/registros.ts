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
  // Uno o varios: id fijo (ver VISIT_TYPES) o nombre de tipo personalizado.
  visits: string[]
  demandas: string[] // categorías pedidas (puede estar vacío)
  userId: string | null // empleado que atendió (registros.user_id), o null
  ventaAdicional: boolean // se llevó algo más (solo si compró)
  esHabitual: boolean | null // true = habitual, false = nuevo, null = sin especificar
  factura: boolean | null // true = con factura, false = sin factura, null = sin especificar
  recomendacion: boolean // vino por recomendación
  redes: boolean // vino por redes sociales
  volvio: boolean // había venido antes y volvió
}

// Fila tal como vuelve de Supabase.
interface RegistroRow {
  id: string
  created_at: string
  // Columnas viejas (una sola opción): se conservan por compatibilidad.
  visit: string | null
  demand: string | null
  // Columnas nuevas (multiselección).
  visits: string[] | null
  demandas: string[] | null
  user_id: string | null
  venta_adicional: boolean
  es_habitual: boolean | null
  factura: boolean | null
  recomendacion: boolean
  redes: boolean
  volvio: boolean
}

function mapRow(row: RegistroRow): Registro {
  return {
    id: row.id,
    ts: new Date(row.created_at).getTime(),
    // Filas migradas traen los arrays; las viejas, el valor único → lo envolvemos.
    visits: row.visits?.length ? row.visits : row.visit ? [row.visit] : [],
    demandas: row.demandas?.length ? row.demandas : row.demand ? [row.demand] : [],
    userId: row.user_id,
    ventaAdicional: row.venta_adicional ?? false,
    esHabitual: row.es_habitual ?? null,
    factura: row.factura ?? null,
    recomendacion: row.recomendacion ?? false,
    redes: row.redes ?? false,
    volvio: row.volvio ?? false,
  }
}

/** Trae todos los registros, del más viejo al más nuevo. */
export async function loadRegistros(): Promise<Registro[]> {
  const { data, error } = await supabase
    .from('registros')
    .select(
      'id, created_at, visit, demand, visits, demandas, user_id, venta_adicional, es_habitual, factura, recomendacion, redes, volvio',
    )
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error cargando registros:', error.message)
    return []
  }
  return (data as RegistroRow[]).map(mapRow)
}

/** Inserta un registro y devuelve la lista completa actualizada. */
export async function addRegistro(input: {
  visits: string[]
  demandas: string[]
  userId: string | null
  ventaAdicional: boolean
  esHabitual: boolean | null
  factura: boolean | null
  recomendacion: boolean
  redes: boolean
  volvio: boolean
}): Promise<Registro[]> {
  const { error } = await supabase.from('registros').insert({
    // Columnas viejas: primer valor, para no romper el NOT NULL de `visit`.
    visit: input.visits[0] ?? null,
    demand: input.demandas[0] ?? null,
    // Columnas nuevas: la selección completa.
    visits: input.visits,
    demandas: input.demandas,
    user_id: input.userId,
    venta_adicional: input.ventaAdicional,
    es_habitual: input.esHabitual,
    factura: input.factura,
    recomendacion: input.recomendacion,
    redes: input.redes,
    volvio: input.volvio,
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

/**
 * Borra un tipo de visita personalizado y devuelve la lista actualizada.
 * Los registros viejos guardan el nombre como texto, así que siguen contando en
 * las estadísticas aunque el tipo ya no esté en el catálogo.
 */
export async function deleteVisitType(nombre: string): Promise<string[]> {
  const { error } = await supabase.from('tipos_visita').delete().eq('nombre', nombre)

  if (error) {
    console.error('Error borrando tipo de visita:', error.message)
    throw new Error(error.message)
  }
  return loadCustomVisitTypes()
}

/* ---------- Tipos de visita FIJOS ocultados ---------- */
// Los 4 tipos fijos (VISIT_TYPES) viven en código, no en la base. Para poder
// "borrarlos" guardamos su id en `tipos_visita_ocultos` y la UI los esconde.
// Las visitas ya registradas con ese tipo se conservan (siguen contando).

/** ids de los tipos fijos que el negocio decidió ocultar. */
export async function loadHiddenDefaults(): Promise<string[]> {
  const { data, error } = await supabase.from('tipos_visita_ocultos').select('visit_id')

  if (error) {
    console.error('Error cargando tipos ocultos:', error.message)
    return []
  }
  return (data as { visit_id: string }[]).map((r) => r.visit_id)
}

/** Oculta un tipo fijo y devuelve la lista actualizada de ocultos. */
export async function hideDefaultVisitType(id: string): Promise<string[]> {
  const { error } = await supabase.from('tipos_visita_ocultos').insert({ visit_id: id })

  // 23505 = unique_violation: ya estaba oculto, no es un error real.
  if (error && error.code !== '23505') {
    console.error('Error ocultando tipo fijo:', error.message)
    throw new Error(error.message)
  }
  return loadHiddenDefaults()
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

/** Borra una categoría del catálogo y devuelve el catálogo actualizado. */
export async function deleteCategory(nombre: string): Promise<string[]> {
  const { error } = await supabase
    .from('categorias_producto')
    .delete()
    .eq('nombre', nombre)

  if (error) {
    console.error('Error borrando categoría:', error.message)
    throw new Error(error.message)
  }
  return loadAllCategories()
}
