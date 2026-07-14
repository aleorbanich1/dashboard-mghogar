import { describe, it, expect } from 'vitest'
import { filtrarPorRango, ordenar, resumen, contactoVacio, type Contacto } from './calendarios'

// Datos calcados de la base de Notion.
const CONTACTOS: Contacto[] = [
  { id: '1', nombre: 'odone sandra', dia: '2026-07-14', segmento: 'Gama alta otoño/invierno', notas: 'no contesto', estado: 'Enviado', wsp: '2213558908' },
  { id: '2', nombre: 'corian angela yolanda', dia: '2026-07-13', segmento: 'Gama media otoño/invierno', notas: 'no tienen whatsapp', estado: 'Enviado', wsp: '2214197129' },
  { id: '3', nombre: 'funes lucas', dia: '2026-07-10', segmento: 'Gama alta otoño/invierno', notas: 'no le llego el mensaje', estado: 'Enviado', wsp: '2215255591' },
  { id: '4', nombre: 'Florida paula', dia: '2026-07-04', segmento: 'Gama baja otoño/invierno', notas: 'salió muy bien', estado: 'Enviado', wsp: '2215659071' },
  { id: '5', nombre: 'sin fecha', dia: '', segmento: '', notas: '', estado: 'Pendiente', wsp: '' },
]

describe('filtrarPorRango', () => {
  it('sin fechas devuelve TODO (incluidas las filas sin día)', () => {
    expect(filtrarPorRango(CONTACTOS, '', '')).toHaveLength(5)
  })

  it('rango cerrado toma los extremos (inclusive)', () => {
    const r = filtrarPorRango(CONTACTOS, '2026-07-10', '2026-07-14')
    expect(r.map((c) => c.id)).toEqual(['1', '2', '3'])
  })

  it('rango invertido se ordena solo', () => {
    const r = filtrarPorRango(CONTACTOS, '2026-07-14', '2026-07-10')
    expect(r.map((c) => c.id)).toEqual(['1', '2', '3'])
  })

  it('solo "desde" toma de esa fecha en adelante', () => {
    expect(filtrarPorRango(CONTACTOS, '2026-07-13', '').map((c) => c.id)).toEqual(['1', '2'])
  })

  it('solo "hasta" toma hasta esa fecha', () => {
    expect(filtrarPorRango(CONTACTOS, '', '2026-07-10').map((c) => c.id)).toEqual(['3', '4'])
  })

  it('las filas sin día quedan fuera de un rango', () => {
    const r = filtrarPorRango(CONTACTOS, '2026-01-01', '2026-12-31')
    expect(r.some((c) => c.id === '5')).toBe(false)
  })

  it('rango sin contactos devuelve vacío', () => {
    expect(filtrarPorRango(CONTACTOS, '2026-08-01', '2026-08-31')).toEqual([])
  })
})

describe('ordenar', () => {
  it('por fecha descendente (default): más recientes primero', () => {
    expect(ordenar(CONTACTOS, 'fecha_desc').map((c) => c.id)).toEqual(['1', '2', '3', '4', '5'])
  })

  it('por fecha ascendente: más antiguos primero, sin fecha al final', () => {
    expect(ordenar(CONTACTOS, 'fecha_asc').map((c) => c.id)).toEqual(['4', '3', '2', '1', '5'])
  })

  it('por segmento (alfabético), desempatando por fecha reciente', () => {
    const r = ordenar(CONTACTOS, 'segmento')
    expect(r.map((c) => c.segmento)).toEqual([
      '', // el que no tiene segmento
      'Gama alta otoño/invierno',
      'Gama alta otoño/invierno',
      'Gama baja otoño/invierno',
      'Gama media otoño/invierno',
    ])
    // dentro de "Gama alta", el más reciente (14/07) antes que el 10/07
    expect(r[1].id).toBe('1')
    expect(r[2].id).toBe('3')
  })

  it('por estado: Pendiente primero (es lo que falta hacer)', () => {
    const r = ordenar(CONTACTOS, 'estado')
    expect(r[0].estado).toBe('Pendiente')
    expect(r.slice(1).every((c) => c.estado === 'Enviado')).toBe(true)
  })

  it('por nombre alfabético', () => {
    expect(ordenar(CONTACTOS, 'nombre').map((c) => c.nombre)).toEqual([
      'corian angela yolanda',
      'Florida paula',
      'funes lucas',
      'odone sandra',
      'sin fecha',
    ])
  })

  it('no muta la lista original', () => {
    const copia = [...CONTACTOS]
    ordenar(CONTACTOS, 'nombre')
    expect(CONTACTOS).toEqual(copia)
  })
})

describe('resumen', () => {
  it('cuenta por estado, del más frecuente al menos', () => {
    expect(resumen(CONTACTOS)).toEqual([
      { estado: 'Enviado', cantidad: 4 },
      { estado: 'Pendiente', cantidad: 1 },
    ])
  })

  it('sin contactos devuelve vacío', () => {
    expect(resumen([])).toEqual([])
  })
})

describe('contactoVacio', () => {
  it('arranca en Pendiente y con el día de hoy', () => {
    const c = contactoVacio()
    expect(c.estado).toBe('Pendiente')
    expect(c.dia).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(c.nombre).toBe('')
  })
})
