import { describe, it, expect } from 'vitest'
import { calcularPrecio } from './calc'

const BASE_INPUT = {
  precioLista: 1000,
  precioContado: 800,
  condicionId: null as string | null,
  clienteEspecial: false,
  masDeCinco: false,
}

describe('calcularPrecio', () => {
  it('caso ok lista — r01 factor 1.0', () => {
    const result = calcularPrecio({ ...BASE_INPUT, condicionId: 'r01' })
    expect(result).toEqual({ tipo: 'ok', precio: 1000, regla: 'Lista 12 cuotas sin interés', base: 'lista', factor: 1.0 })
  })

  it('caso ok lista con descuento — r02 factor 0.95', () => {
    const result = calcularPrecio({ ...BASE_INPUT, condicionId: 'r02' })
    expect(result).toEqual({ tipo: 'ok', precio: 950, regla: 'Lista 9 cuotas', base: 'lista', factor: 0.95 })
  })

  it('caso ok contado — r10 factor 0.95', () => {
    const result = calcularPrecio({ ...BASE_INPUT, condicionId: 'r10' })
    expect(result).toEqual({ tipo: 'ok', precio: 760, regla: 'Contado efectivo con factura', base: 'contado', factor: 0.95 })
  })

  it('caso ok contado sin factura — r11 factor 0.9', () => {
    const result = calcularPrecio({ ...BASE_INPUT, condicionId: 'r11' })
    expect(result).toEqual({ tipo: 'ok', precio: 720, regla: 'Contado efectivo sin factura', base: 'contado', factor: 0.9 })
  })

  it('clienteEspecial → ale', () => {
    const result = calcularPrecio({ ...BASE_INPUT, condicionId: 'r01', clienteEspecial: true })
    expect(result).toEqual({ tipo: 'ale' })
  })

  it('masDeCinco → ale', () => {
    const result = calcularPrecio({ ...BASE_INPUT, condicionId: 'r01', masDeCinco: true })
    expect(result).toEqual({ tipo: 'ale' })
  })

  it('clienteEspecial + masDeCinco → ale (no procesar nada más)', () => {
    const result = calcularPrecio({ ...BASE_INPUT, clienteEspecial: true, masDeCinco: true })
    expect(result).toEqual({ tipo: 'ale' })
  })

  it('sin condicionId → falta_condicion', () => {
    const result = calcularPrecio({ ...BASE_INPUT, condicionId: null })
    expect(result).toEqual({ tipo: 'falta_condicion' })
  })

  it('condicionId vacío → falta_condicion', () => {
    const result = calcularPrecio({ ...BASE_INPUT, condicionId: '' })
    expect(result).toEqual({ tipo: 'falta_condicion' })
  })

  it('falta precio lista — base lista sin precioLista', () => {
    const result = calcularPrecio({ ...BASE_INPUT, condicionId: 'r01', precioLista: null })
    expect(result).toEqual({ tipo: 'falta_precio', cual: 'lista' })
  })

  it('falta precio contado — base contado sin precioContado', () => {
    const result = calcularPrecio({ ...BASE_INPUT, condicionId: 'r10', precioContado: null })
    expect(result).toEqual({ tipo: 'falta_precio', cual: 'contado' })
  })

  it('id inexistente → regla_no_encontrada', () => {
    const result = calcularPrecio({ ...BASE_INPUT, condicionId: 'r99' })
    expect(result).toEqual({ tipo: 'regla_no_encontrada' })
  })

  // Descuento de haberes (r06): interés simple sobre precio de lista.
  // Ejemplos verificados con Ale: lista=100, tasa 6% → 10 cuotas=160, 3 cuotas=118, etc.
  it('haberes — 100 en 10 cuotas al 6% → 160 (10 cuotas de 16)', () => {
    const result = calcularPrecio({
      ...BASE_INPUT,
      precioLista: 100,
      condicionId: 'r06',
      tasaMensualSindicato: 0.06,
      cantidadCuotas: 10,
    })
    expect(result).toEqual({
      tipo: 'ok',
      precio: 160,
      regla: 'Lista · Descuento de haberes',
      base: 'lista',
      factor: 1.6,
      tasaMensual: 0.06,
      cuotas: 10,
      precioPorCuota: 16,
    })
  })

  it('haberes — 100 en 3 cuotas al 6% → 118', () => {
    const result = calcularPrecio({
      ...BASE_INPUT,
      precioLista: 100,
      condicionId: 'r06',
      tasaMensualSindicato: 0.06,
      cantidadCuotas: 3,
    })
    expect(result).toMatchObject({ tipo: 'ok', precio: 118, factor: 1.18 })
  })

  it('haberes — 6/7/8 cuotas al 6% → factores 1.36 / 1.42 / 1.48', () => {
    const f = (cuotas: number) =>
      calcularPrecio({
        ...BASE_INPUT,
        precioLista: 100,
        condicionId: 'r06',
        tasaMensualSindicato: 0.06,
        cantidadCuotas: cuotas,
      })
    expect((f(6) as { factor: number }).factor).toBeCloseTo(1.36, 10)
    expect((f(7) as { factor: number }).factor).toBeCloseTo(1.42, 10)
    expect((f(8) as { factor: number }).factor).toBeCloseTo(1.48, 10)
  })

  it('haberes — tasa editable por sindicato (5%)', () => {
    const result = calcularPrecio({
      ...BASE_INPUT,
      precioLista: 100,
      condicionId: 'r06',
      tasaMensualSindicato: 0.05,
      cantidadCuotas: 10,
    })
    expect(result).toMatchObject({ tipo: 'ok', precio: 150, factor: 1.5, precioPorCuota: 15 })
  })

  it('haberes sin tasa → falta_datos_haberes', () => {
    const result = calcularPrecio({
      ...BASE_INPUT,
      precioLista: 100,
      condicionId: 'r06',
      cantidadCuotas: 10,
    })
    expect(result).toEqual({ tipo: 'falta_datos_haberes', cual: 'tasa' })
  })

  it('haberes sin cuotas → falta_datos_haberes', () => {
    const result = calcularPrecio({
      ...BASE_INPUT,
      precioLista: 100,
      condicionId: 'r06',
      tasaMensualSindicato: 0.06,
    })
    expect(result).toEqual({ tipo: 'falta_datos_haberes', cual: 'cuotas' })
  })

  it('haberes sin precio de lista → falta_precio lista', () => {
    const result = calcularPrecio({
      ...BASE_INPUT,
      precioLista: null,
      condicionId: 'r06',
      tasaMensualSindicato: 0.06,
      cantidadCuotas: 10,
    })
    expect(result).toEqual({ tipo: 'falta_precio', cual: 'lista' })
  })

  it('haberes + cliente especial → ale (regla intacta)', () => {
    const result = calcularPrecio({
      ...BASE_INPUT,
      precioLista: 100,
      condicionId: 'r06',
      tasaMensualSindicato: 0.06,
      cantidadCuotas: 10,
      clienteEspecial: true,
    })
    expect(result).toEqual({ tipo: 'ale' })
  })
})
