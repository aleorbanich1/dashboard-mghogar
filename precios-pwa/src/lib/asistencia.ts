/**
 * Registro de llegada — parser y algoritmo de asistencia.
 *
 * Procesa el .txt que exporta el reloj de huellas (formato UDISKLOG, separado
 * por tabs). Cada fila es una "marca" (una pasada de huella). El algoritmo:
 *
 *  1. Parsea las filas (ignora encabezados y líneas rotas).
 *  2. Colapsa marcas duplicadas: la misma persona marcando 2 veces en pocos
 *     minutos (ej. moreno 08:41 y 08:45) cuenta una sola vez.
 *  3. Empareja las marcas de cada día de a 2 en orden: 1ª = entrada, 2ª =
 *     salida, 3ª = entrada tarde, 4ª = salida tarde (turno partido). Si la
 *     cantidad es impar, el último turno queda "sin salida" y el día se marca
 *     para revisar.
 *  4. Calcula horas trabajadas (solo turnos completos), tardanzas (contra una
 *     hora esperada por empleado, con tolerancia) y ausencias (días laborables
 *     con actividad de otros pero sin marcas del empleado — así un feriado en
 *     el que no marcó nadie no cuenta como ausencia de todos).
 */

export interface Marca {
  enNo: string
  nombre: string
  /** 'YYYY-MM-DD' */
  fecha: string
  /** 'HH:MM' */
  hora: string
  /** minutos desde las 00:00 (para comparar/restar) */
  min: number
}

export interface ParseResult {
  marcas: Marca[]
  /** líneas con datos que no se pudieron interpretar */
  lineasIgnoradas: number
}

export interface Turno {
  entrada: string
  /** null = falta la marca de salida */
  salida: string | null
  /** duración en minutos (0 si el turno está incompleto) */
  minutos: number
  /** minutos de atraso en la entrada de ESTE turno (+tolerancia), o null */
  tardeMin: number | null
  /** minutos que se fue antes de la salida esperada de ESTE turno, o null */
  tempranoMin: number | null
}

export interface DiaReporte {
  fecha: string
  turnos: Turno[]
  /** minutos trabajados del día (solo turnos completos) */
  minutos: number
  /** atraso total del día sumando los turnos, o null si llegó en hora */
  tardeMin: number | null
  /** minutos que se fue antes (sumando turnos), o null */
  tempranoMin: number | null
  /** true si la cantidad de marcas fue impar (falta una marca) */
  incompleto: boolean
}

export interface EmpleadoReporte {
  enNo: string
  nombre: string
  dias: DiaReporte[]
  totalMinutos: number
  diasTrabajados: number
  tardanzas: number
  /** días en que se fue antes de la salida esperada */
  salidasTempranas: number
  /** fechas 'YYYY-MM-DD' de días laborables con actividad ajena y sin marcas */
  ausencias: string[]
}

/** Horario esperado de un turno. null = sin control para ese extremo. */
export interface TurnoEsperado {
  entrada: string | null
  salida: string | null
}

/**
 * Horario esperado de un empleado. Con `dobleTurno` en true se controlan los
 * dos turnos (mañana y tarde); en false, solo el primero (jornada única).
 */
export interface HorarioEmpleado {
  dobleTurno: boolean
  turno1: TurnoEsperado
  turno2: TurnoEsperado
}

export function horarioVacio(): HorarioEmpleado {
  return {
    dobleTurno: false,
    turno1: { entrada: null, salida: null },
    turno2: { entrada: null, salida: null },
  }
}

export interface DuplicadoDescartado {
  nombre: string
  fecha: string
  hora: string
  horaOriginal: string
}

export interface Reporte {
  empleados: EmpleadoReporte[]
  duplicados: DuplicadoDescartado[]
  desde: string
  hasta: string
}

export interface ConfigReporte {
  /** enNo de los empleados a incluir */
  incluidos: Set<string>
  /** horario esperado por empleado (entrada/salida de cada turno) */
  horarios: Record<string, HorarioEmpleado>
  toleranciaMin: number
  /** días laborables: 0 = domingo … 6 = sábado (getDay de JS) */
  diasLaborables: Set<number>
  /** ventana en minutos para colapsar marcas duplicadas */
  ventanaDupMin: number
}

// ── Parseo ──────────────────────────────────────────────────────────────────

// Fila de datos: nº registro, máquina, legajo, nombre, modo, io, fecha  hora
const FILA_RE =
  /^\d+\t+\d+\t+(\d+)\t+(.+?)\t+\d+\t+\d+\t+(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s*$/

export function parseUdiskLog(texto: string): ParseResult {
  const marcas: Marca[] = []
  let lineasIgnoradas = 0

  for (const linea of texto.split(/\r?\n/)) {
    const t = linea.trim()
    if (t === '' || t.startsWith('UDISKLOG') || t.startsWith('No\t')) continue
    const m = FILA_RE.exec(linea)
    if (!m) {
      lineasIgnoradas++
      continue
    }
    const [, enNoRaw, nombreRaw, anio, mes, dia, hh, mm] = m
    marcas.push({
      enNo: String(Number(enNoRaw)), // saca ceros a la izquierda
      nombre: nombreRaw.trim(),
      fecha: `${anio}-${mes}-${dia}`,
      hora: `${hh}:${mm}`,
      min: Number(hh) * 60 + Number(mm),
    })
  }

  marcas.sort((a, b) =>
    a.fecha !== b.fecha ? a.fecha.localeCompare(b.fecha) : a.min - b.min
  )
  return { marcas, lineasIgnoradas }
}

// ── Utilidades ──────────────────────────────────────────────────────────────

export function minutosAHora(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export function fmtHoras(min: number): string {
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} m`
}

/** '2026-05-02' → '02/05/2026' */
export function fmtFecha(fecha: string): string {
  const [a, m, d] = fecha.split('-')
  return `${d}/${m}/${a}`
}

const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export function diaSemana(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(a, m - 1, d, 12).getDay()
}

export function nombreDia(fecha: string): string {
  return DIAS_SEMANA[diaSemana(fecha)]
}

/** Nombre para mostrar: "gabriela ver" → "Gabriela Ver" */
export function nombrePropio(nombre: string): string {
  return nombre
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

// ── Algoritmo ───────────────────────────────────────────────────────────────

/** Lista de empleados presentes en el archivo (enNo → último nombre visto). */
export function empleadosDe(marcas: Marca[]): { enNo: string; nombre: string }[] {
  const map = new Map<string, string>()
  for (const m of marcas) map.set(m.enNo, m.nombre)
  return [...map.entries()]
    .map(([enNo, nombre]) => ({ enNo, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** Mediana redondeada al cuarto de hora, o null si no hay datos. */
function medianaHora(valores: number[]): string | null {
  if (valores.length === 0) return null
  const orden = [...valores].sort((a, b) => a - b)
  const mediana = orden[Math.floor((orden.length - 1) / 2)]
  return minutosAHora(Math.round(mediana / 15) * 15)
}

/** Agrupa las marcas de un empleado por día (ya ordenadas por hora). */
function diasDe(marcas: Marca[], enNo: string): number[][] {
  const dias = new Map<string, number[]>()
  for (const m of marcas) {
    if (m.enNo !== enNo) continue
    const d = dias.get(m.fecha)
    if (d) d.push(m.min)
    else dias.set(m.fecha, [m.min])
  }
  return [...dias.values()]
}

/**
 * Detecta el horario habitual de un empleado a partir de sus propias marcas.
 *
 * - Doble turno: si la mayoría de sus días tiene 4 marcas o más (entra, sale al
 *   mediodía, vuelve y sale a la noche).
 * - Cada extremo (entrada/salida de cada turno) sale de la mediana de esa marca
 *   en todos sus días, redondeada al cuarto de hora. Así el control se adapta a
 *   cada horario real: quien entra 12:40 no queda "tarde" contra las 09:00.
 */
export function sugerirHorario(marcas: Marca[], enNo: string): HorarioEmpleado {
  const dias = diasDe(marcas, enNo)
  if (dias.length === 0) return horarioVacio()

  const conDoble = dias.filter((d) => d.length >= 4).length
  const dobleTurno = conDoble > dias.length / 2

  const enIndice = (i: number) => medianaHora(dias.filter((d) => d.length > i).map((d) => d[i]))

  // Sin doble turno, la salida es la ÚLTIMA marca del día (no la segunda).
  const salidaUnica = medianaHora(dias.filter((d) => d.length >= 2).map((d) => d[d.length - 1]))

  return {
    dobleTurno,
    turno1: {
      entrada: enIndice(0),
      salida: dobleTurno ? enIndice(1) : salidaUnica,
    },
    turno2: {
      entrada: dobleTurno ? enIndice(2) : null,
      salida: dobleTurno ? enIndice(3) : null,
    },
  }
}

/** Colapsa marcas de la misma persona a menos de `ventanaMin` de la anterior. */
export function colapsarDuplicados(
  marcas: Marca[],
  ventanaMin: number
): { marcas: Marca[]; duplicados: DuplicadoDescartado[] } {
  const limpias: Marca[] = []
  const duplicados: DuplicadoDescartado[] = []
  const ultima = new Map<string, Marca>()

  for (const m of marcas) {
    const prev = ultima.get(m.enNo)
    if (prev && prev.fecha === m.fecha && m.min - prev.min <= ventanaMin) {
      duplicados.push({
        nombre: m.nombre,
        fecha: m.fecha,
        hora: m.hora,
        horaOriginal: prev.hora,
      })
      continue // se queda la primera marca de la ráfaga
    }
    limpias.push(m)
    ultima.set(m.enNo, m)
  }
  return { marcas: limpias, duplicados }
}

/**
 * Empareja las marcas de un día de a 2: [entrada, salida, entrada, salida…] y
 * compara cada turno con su horario esperado (si hay uno cargado).
 *
 * El turno N se compara contra turno1 si N = 0 y contra turno2 si N = 1. Los
 * turnos extra (3º en adelante) no se controlan: se listan tal cual.
 */
export function emparejarDia(
  minutos: number[],
  horario: HorarioEmpleado = horarioVacio(),
  toleranciaMin = 0
): Turno[] {
  const esperados = [horario.turno1, horario.dobleTurno ? horario.turno2 : null]

  const turnos: Turno[] = []
  for (let i = 0; i < minutos.length; i += 2) {
    const entrada = minutos[i]
    const salida = i + 1 < minutos.length ? minutos[i + 1] : null
    const esperado = esperados[turnos.length] ?? null

    let tardeMin: number | null = null
    if (esperado?.entrada) {
      const ref = horaAMinutos(esperado.entrada)
      if (entrada > ref + toleranciaMin) tardeMin = entrada - ref
    }

    let tempranoMin: number | null = null
    if (esperado?.salida && salida !== null) {
      const ref = horaAMinutos(esperado.salida)
      if (salida < ref - toleranciaMin) tempranoMin = ref - salida
    }

    turnos.push({
      entrada: minutosAHora(entrada),
      salida: salida === null ? null : minutosAHora(salida),
      minutos: salida === null ? 0 : salida - entrada,
      tardeMin,
      tempranoMin,
    })
  }
  return turnos
}

export function generarReporte(todas: Marca[], config: ConfigReporte): Reporte {
  const { marcas, duplicados } = colapsarDuplicados(todas, config.ventanaDupMin)

  if (marcas.length === 0) {
    return { empleados: [], duplicados, desde: '', hasta: '' }
  }

  const desde = marcas[0].fecha
  const hasta = marcas[marcas.length - 1].fecha

  // Fechas con actividad de CUALQUIER persona (para no contar como ausencia
  // un feriado o un día en que el local no abrió).
  const fechasConActividad = new Set(marcas.map((m) => m.fecha))

  // Todas las fechas laborables del período con actividad.
  const laborables: string[] = []
  {
    const [a, m, d] = desde.split('-').map(Number)
    const fin = hasta
    const cursor = new Date(a, m - 1, d, 12)
    for (;;) {
      const fecha = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      if (fecha > fin) break
      if (config.diasLaborables.has(cursor.getDay()) && fechasConActividad.has(fecha)) {
        laborables.push(fecha)
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  // Agrupar por empleado → día.
  const porEmpleado = new Map<string, { nombre: string; dias: Map<string, number[]> }>()
  for (const m of marcas) {
    if (!config.incluidos.has(m.enNo)) continue
    let emp = porEmpleado.get(m.enNo)
    if (!emp) {
      emp = { nombre: m.nombre, dias: new Map() }
      porEmpleado.set(m.enNo, emp)
    }
    emp.nombre = m.nombre
    const dia = emp.dias.get(m.fecha)
    if (dia) dia.push(m.min)
    else emp.dias.set(m.fecha, [m.min])
  }

  const empleados: EmpleadoReporte[] = []
  for (const [enNo, emp] of porEmpleado) {
    const horario = config.horarios[enNo] ?? horarioVacio()

    const dias: DiaReporte[] = []
    for (const [fecha, mins] of [...emp.dias.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const turnos = emparejarDia(mins, horario, config.toleranciaMin)
      const sumar = (f: (t: Turno) => number | null): number | null => {
        const total = turnos.reduce((acc, t) => acc + (f(t) ?? 0), 0)
        return total > 0 ? total : null
      }
      dias.push({
        fecha,
        turnos,
        minutos: turnos.reduce((acc, t) => acc + t.minutos, 0),
        tardeMin: sumar((t) => t.tardeMin),
        tempranoMin: sumar((t) => t.tempranoMin),
        incompleto: mins.length % 2 !== 0,
      })
    }

    const fechasTrabajadas = new Set(dias.map((d) => d.fecha))
    empleados.push({
      enNo,
      nombre: emp.nombre,
      dias,
      totalMinutos: dias.reduce((acc, d) => acc + d.minutos, 0),
      diasTrabajados: dias.length,
      tardanzas: dias.filter((d) => d.tardeMin !== null).length,
      salidasTempranas: dias.filter((d) => d.tempranoMin !== null).length,
      ausencias: laborables.filter((f) => !fechasTrabajadas.has(f)),
    })
  }

  empleados.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return { empleados, duplicados, desde, hasta }
}
