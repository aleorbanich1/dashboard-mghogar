import { describe, it, expect } from 'vitest'
import {
  parseUdiskLog,
  colapsarDuplicados,
  emparejarDia,
  sugerirHorario,
  horarioVacio,
  generarReporte,
  empleadosDe,
  fmtHoras,
  fmtFecha,
  type ConfigReporte,
  type HorarioEmpleado,
} from './asistencia'

/** Horario de jornada única (un solo turno). */
function unico(entrada: string | null, salida: string | null = null): HorarioEmpleado {
  return { dobleTurno: false, turno1: { entrada, salida }, turno2: { entrada: null, salida: null } }
}

/** Horario de doble turno (mañana y tarde). */
function doble(
  e1: string | null,
  s1: string | null,
  e2: string | null,
  s2: string | null
): HorarioEmpleado {
  return { dobleTurno: true, turno1: { entrada: e1, salida: s1 }, turno2: { entrada: e2, salida: s2 } }
}

// Fragmento real del archivo del reloj (tabs entre campos, nombre con padding).
const SAMPLE = [
  'UDISKLOG\tversion=2\tdate=2026-06-01\tfirmware=F254HS30s_Psf_150',
  'No\tMchn\tEnNo\t\tName\t\tMode\tIOMd\tDateTime\t',
  '000001\t1\t000000004\tmoreno        \t268435456\t2305\t2026/05/02  08:51:35',
  '000002\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/02  08:53:32',
  '000009\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/02  13:00:24',
  '000012\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/02  15:55:13',
  '000018\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/02  20:04:06',
  '000016\t1\t000000004\tmoreno        \t268435456\t2305\t2026/05/02  16:39:48',
].join('\n')

function configBase(over: Partial<ConfigReporte> = {}): ConfigReporte {
  return {
    incluidos: new Set(['3', '4']),
    horarios: {},
    toleranciaMin: 10,
    diasLaborables: new Set([1, 2, 3, 4, 5, 6]),
    ventanaDupMin: 10,
    ...over,
  }
}

describe('parseUdiskLog', () => {
  it('parsea filas reales, ignora encabezados y normaliza campos', () => {
    const { marcas, lineasIgnoradas } = parseUdiskLog(SAMPLE)
    expect(lineasIgnoradas).toBe(0)
    expect(marcas).toHaveLength(6)
    // ordenadas por fecha y hora, con legajo sin ceros y nombre sin padding
    expect(marcas[0]).toMatchObject({ enNo: '4', nombre: 'moreno', fecha: '2026-05-02', hora: '08:51' })
    expect(marcas[1].nombre).toBe('gabriela ver')
    expect(marcas.map((m) => m.hora)).toEqual(['08:51', '08:53', '13:00', '15:55', '16:39', '20:04'])
  })

  it('cuenta las líneas con datos rotos sin explotar', () => {
    const { marcas, lineasIgnoradas } = parseUdiskLog(SAMPLE + '\nbasura sin formato\n')
    expect(marcas).toHaveLength(6)
    expect(lineasIgnoradas).toBe(1)
  })
})

describe('colapsarDuplicados', () => {
  it('colapsa la doble marca de moreno (08:41 y 08:45) y se queda la primera', () => {
    const texto = [
      '000430\t1\t000000004\tmoreno        \t268435456\t2305\t2026/05/29  08:41:40',
      '000431\t1\t000000004\tmoreno        \t268435456\t2305\t2026/05/29  08:45:29',
      '000445\t1\t000000004\tmoreno        \t268435456\t2305\t2026/05/29  16:47:59',
    ].join('\n')
    const { marcas } = parseUdiskLog(texto)
    const r = colapsarDuplicados(marcas, 10)
    expect(r.marcas.map((m) => m.hora)).toEqual(['08:41', '16:47'])
    expect(r.duplicados).toHaveLength(1)
    expect(r.duplicados[0]).toMatchObject({ nombre: 'moreno', hora: '08:45', horaOriginal: '08:41' })
  })

  it('NO colapsa marcas legítimas separadas por horas', () => {
    const { marcas } = parseUdiskLog(SAMPLE)
    const r = colapsarDuplicados(marcas, 10)
    expect(r.marcas).toHaveLength(6)
    expect(r.duplicados).toHaveLength(0)
  })
})

describe('emparejarDia', () => {
  it('4 marcas → dos turnos completos (turno partido)', () => {
    // gabriela 02/05: 08:53–13:00 y 15:55–20:04
    const turnos = emparejarDia([533, 780, 955, 1204])
    expect(turnos).toEqual([
      { entrada: '08:53', salida: '13:00', minutos: 247, tardeMin: null, tempranoMin: null },
      { entrada: '15:55', salida: '20:04', minutos: 249, tardeMin: null, tempranoMin: null },
    ])
  })

  it('2 marcas → jornada única', () => {
    const turnos = emparejarDia([760, 996])
    expect(turnos).toEqual([
      { entrada: '12:40', salida: '16:36', minutos: 236, tardeMin: null, tempranoMin: null },
    ])
  })

  it('cantidad impar → el último turno queda sin salida y no suma horas', () => {
    const turnos = emparejarDia([533, 780, 955])
    expect(turnos[1]).toMatchObject({ entrada: '15:55', salida: null, minutos: 0 })
  })

  it('doble turno: controla la entrada y la salida de CADA turno por separado', () => {
    // esperado: 09:00–13:00 y 16:00–20:00, tolerancia 10.
    // real: entra 08:53 (en hora), sale 13:00 (en hora),
    //       vuelve 16:30 (tarde 30), se va 19:30 (30 antes).
    const turnos = emparejarDia([533, 780, 990, 1170], doble('09:00', '13:00', '16:00', '20:00'), 10)
    expect(turnos[0]).toMatchObject({ tardeMin: null, tempranoMin: null })
    expect(turnos[1]).toMatchObject({ entrada: '16:30', tardeMin: 30, tempranoMin: 30 })
  })

  it('sin doble turno, el segundo turno NO se controla contra turno2', () => {
    const turnos = emparejarDia([533, 780, 990, 1170], unico('09:00', '13:00'), 10)
    expect(turnos[1]).toMatchObject({ tardeMin: null, tempranoMin: null })
  })

  it('la tolerancia también aplica a la salida anticipada', () => {
    // sale 12:55 con salida esperada 13:00 y tolerancia 10 → dentro de tolerancia
    const turnos = emparejarDia([540, 775], unico('09:00', '13:00'), 10)
    expect(turnos[0].tempranoMin).toBeNull()
  })
})

describe('sugerirHorario', () => {
  it('detecta jornada única y toma la ÚLTIMA marca como salida', () => {
    const texto = [
      '000001\t1\t000000010\troxana        \t268435456\t2305\t2026/05/02  12:40:53',
      '000002\t1\t000000010\troxana        \t268435456\t2305\t2026/05/02  16:36:38',
      '000003\t1\t000000010\troxana        \t268435456\t2305\t2026/05/04  12:39:39',
      '000004\t1\t000000010\troxana        \t268435456\t2305\t2026/05/04  16:33:00',
      '000005\t1\t000000010\troxana        \t268435456\t2305\t2026/05/05  12:40:58',
      '000006\t1\t000000010\troxana        \t268435456\t2305\t2026/05/05  16:38:00',
    ].join('\n')
    const { marcas } = parseUdiskLog(texto)
    // entradas 12:40/12:39/12:40 → mediana 12:40 → 12:45; salidas ~16:35 → 16:30
    expect(sugerirHorario(marcas, '10')).toEqual({
      dobleTurno: false,
      turno1: { entrada: '12:45', salida: '16:30' },
      turno2: { entrada: null, salida: null },
    })
  })

  it('detecta doble turno cuando la mayoría de los días tiene 4 marcas', () => {
    const texto = [
      '000001\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/02  09:00:00',
      '000002\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/02  13:00:00',
      '000003\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/02  16:00:00',
      '000004\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/02  20:00:00',
      '000005\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/04  09:00:00',
      '000006\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/04  13:00:00',
      '000007\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/04  16:00:00',
      '000008\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/04  20:00:00',
    ].join('\n')
    const { marcas } = parseUdiskLog(texto)
    expect(sugerirHorario(marcas, '3')).toEqual({
      dobleTurno: true,
      turno1: { entrada: '09:00', salida: '13:00' },
      turno2: { entrada: '16:00', salida: '20:00' },
    })
  })

  it('empleado sin marcas → horario vacío', () => {
    expect(sugerirHorario([], '99')).toEqual(horarioVacio())
  })
})

describe('generarReporte', () => {
  it('arma el día con turno partido, horas y sin tardanza dentro de tolerancia', () => {
    const { marcas } = parseUdiskLog(SAMPLE)
    const rep = generarReporte(marcas, configBase({ horarios: { '3': unico('08:50') } }))
    const gabi = rep.empleados.find((e) => e.enNo === '3')!
    expect(gabi.dias).toHaveLength(1)
    expect(gabi.dias[0].turnos).toHaveLength(2)
    expect(gabi.dias[0].minutos).toBe(247 + 249)
    // 08:53 con esperada 08:50 + 10 min de tolerancia → NO es tardanza
    expect(gabi.dias[0].tardeMin).toBeNull()
    expect(gabi.tardanzas).toBe(0)
  })

  it('marca tardanza cuando supera esperada + tolerancia', () => {
    const { marcas } = parseUdiskLog(SAMPLE)
    const rep = generarReporte(marcas, configBase({ horarios: { '3': unico('08:30') } }))
    const gabi = rep.empleados.find((e) => e.enNo === '3')!
    // 08:53 vs 08:30 (+10) → tarde por 23 minutos
    expect(gabi.dias[0].tardeMin).toBe(23)
    expect(gabi.tardanzas).toBe(1)
  })

  it('doble turno: suma los atrasos de los dos turnos y cuenta la salida anticipada', () => {
    const { marcas } = parseUdiskLog(SAMPLE)
    // gabriela real: 08:53–13:00 y 15:55–20:04.
    // esperado: 08:30–13:00 y 15:30–20:30 → tarde 23 + 25 = 48; se fue 26 antes.
    const rep = generarReporte(
      marcas,
      configBase({ horarios: { '3': doble('08:30', '13:00', '15:30', '20:30') } })
    )
    const gabi = rep.empleados.find((e) => e.enNo === '3')!
    expect(gabi.dias[0].tardeMin).toBe(48)
    expect(gabi.dias[0].tempranoMin).toBe(26)
    expect(gabi.tardanzas).toBe(1)
    expect(gabi.salidasTempranas).toBe(1)
  })

  it('sin horario cargado no controla tardanzas ni salidas', () => {
    const { marcas } = parseUdiskLog(SAMPLE)
    const rep = generarReporte(marcas, configBase())
    expect(rep.empleados.every((e) => e.tardanzas === 0 && e.salidasTempranas === 0)).toBe(true)
  })

  it('ausencias: día laborable con actividad ajena y sin marcas del empleado', () => {
    const texto = [
      // lunes 04/05: marcan los dos
      '000001\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/04  09:00:00',
      '000002\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/04  13:00:00',
      '000003\t1\t000000004\tmoreno        \t268435456\t2305\t2026/05/04  09:00:00',
      '000004\t1\t000000004\tmoreno        \t268435456\t2305\t2026/05/04  17:00:00',
      // martes 05/05: solo gabriela → ausencia de moreno
      '000005\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/05  09:00:00',
      '000006\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/05  13:00:00',
      // miércoles 06/05 nadie marcó (feriado) → NO cuenta como ausencia
      // jueves 07/05: los dos de vuelta
      '000007\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/07  09:00:00',
      '000008\t1\t000000004\tmoreno        \t268435456\t2305\t2026/05/07  09:00:00',
    ].join('\n')
    const { marcas } = parseUdiskLog(texto)
    const rep = generarReporte(marcas, configBase())
    const moreno = rep.empleados.find((e) => e.enNo === '4')!
    expect(moreno.ausencias).toEqual(['2026-05-05'])
    const gabi = rep.empleados.find((e) => e.enNo === '3')!
    expect(gabi.ausencias).toEqual([])
  })

  it('el domingo no cuenta como ausencia aunque alguien haya marcado', () => {
    const texto = [
      // domingo 03/05: marca solo gabriela
      '000001\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/03  09:00:00',
      '000002\t1\t000000004\tmoreno        \t268435456\t2305\t2026/05/04  09:00:00',
      '000003\t1\t000000003\tgabriela ver  \t268435456\t2305\t2026/05/04  09:05:00',
    ].join('\n')
    const { marcas } = parseUdiskLog(texto)
    const rep = generarReporte(marcas, configBase())
    const moreno = rep.empleados.find((e) => e.enNo === '4')!
    expect(moreno.ausencias).toEqual([])
  })

  it('respeta la lista de incluidos', () => {
    const { marcas } = parseUdiskLog(SAMPLE)
    const rep = generarReporte(marcas, configBase({ incluidos: new Set(['4']) }))
    expect(rep.empleados.map((e) => e.enNo)).toEqual(['4'])
  })

  it('período detectado y helpers de formato', () => {
    const { marcas } = parseUdiskLog(SAMPLE)
    const rep = generarReporte(marcas, configBase())
    expect(rep.desde).toBe('2026-05-02')
    expect(rep.hasta).toBe('2026-05-02')
    expect(fmtFecha(rep.desde)).toBe('02/05/2026')
    expect(fmtHoras(496)).toBe('8 h 16 m')
  })
})

describe('empleadosDe', () => {
  it('lista única ordenada por nombre', () => {
    const { marcas } = parseUdiskLog(SAMPLE)
    expect(empleadosDe(marcas)).toEqual([
      { enNo: '3', nombre: 'gabriela ver' },
      { enNo: '4', nombre: 'moreno' },
    ])
  })
})
