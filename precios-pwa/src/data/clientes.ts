/**
 * FUENTE ÚNICA DE OPCIONES (single source of truth).
 *
 * Todos los empleados registran con estas mismas categorías cerradas. Nadie
 * escribe con sus palabras: así los números se pueden sumar y graficar.
 *
 * - VISIT_TYPES: qué hizo la persona que entró (lista fija, no editable).
 * - PRODUCT_CATEGORIES_SEED: catálogo base de productos pedidos. Las categorías
 *   nuevas que cargue el negocio se guardan aparte (ver lib/registros.ts) y se
 *   combinan con esta semilla, de modo que aparecen para todos al mismo tiempo.
 */

export type VisitTypeId =
  | 'solo_miro'
  | 'pregunto_se_fue'
  | 'pregunto_compro'
  | 'busco_puntual'

export type VisitTone = 'mira' | 'pregunta' | 'compra' | 'busca'

export interface VisitType {
  id: VisitTypeId
  label: string
  short: string
  tone: VisitTone
}

export const VISIT_TYPES: VisitType[] = [
  { id: 'solo_miro', label: 'Solo miró y se fue', short: 'Solo miró', tone: 'mira' },
  { id: 'pregunto_se_fue', label: 'Preguntó precio y se fue', short: 'Preguntó', tone: 'pregunta' },
  { id: 'pregunto_compro', label: 'Preguntó precio y compró', short: 'Compró', tone: 'compra' },
  { id: 'busco_puntual', label: 'Vino a buscar algo puntual', short: 'Buscó puntual', tone: 'busca' },
]

/** Color por tono, usado en botones y gráficos para mantener coherencia. */
export const TONE_COLOR: Record<VisitTone, string> = {
  mira: '#64748b', // slate-500: entró pero no conectó
  pregunta: '#d97706', // amber-600: hubo interés
  compra: '#059669', // emerald-600: conversión
  busca: '#0284c7', // sky-600: demanda concreta
}

/** Color para los tipos de visita personalizados (los que carga el negocio). */
export const CUSTOM_VISIT_COLOR = '#7c3aed' // violet-600

/** Color para los empleados en los gráficos de "quién atiende / convierte". */
export const EMPLEADO_COLOR = '#0d9488' // teal-600

export const PRODUCT_CATEGORIES_SEED: string[] = [
  'Termos',
  'Mesas de TV',
  'Sillas',
  'Celulares',
  'Motos',
  'Bazar/Blanquería',
  'Heladeras',
  'Lavarropas',
  'Televisores',
  'Colchones',
  'Cocinas',
  'Ventiladores',
]
