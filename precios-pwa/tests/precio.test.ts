import { describe, it, expect, beforeAll } from 'vitest'
import handler from '../netlify/functions/precio.mts'

beforeAll(() => {
  process.env.API_TOKEN = 'secreto-test'
})

function post(body: unknown, token: string | null = 'secreto-test') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return handler(
    new Request('https://x/api/precio', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  )
}

describe('POST /api/precio', () => {
  it('rechaza sin token → 401', async () => {
    const r = await post({ condicionId: 'r11', precioContado: 100 }, null)
    expect(r.status).toBe(401)
  })

  it('rechaza token inválido → 401', async () => {
    const r = await post({ condicionId: 'r11', precioContado: 100 }, 'malo')
    expect(r.status).toBe(401)
  })

  it('efectivo sin factura (r11) → 95% del contado', async () => {
    const r = await post({ condicionId: 'r11', precioContado: 1000 })
    const j = await r.json()
    expect(j).toMatchObject({ ok: true, estado: 'ok', precio: 950, factor: 0.95 })
  })

  it('resuelve por alias "metodo"', async () => {
    const r = await post({ metodo: 'efectivo sin factura', precioContado: 1000 })
    const j = await r.json()
    expect(j).toMatchObject({ ok: true, precio: 950, condicionId: 'r11' })
  })

  it('descuento de haberes con tasa en % → cuotas', async () => {
    const r = await post({
      condicionId: 'r06',
      precioLista: 100,
      tasaMensual: 6,
      cuotas: 10,
    })
    const j = await r.json()
    expect(j).toMatchObject({ ok: true, precio: 160, cuotas: 10, precioPorCuota: 16 })
  })

  it('cliente especial → consultar a Ale', async () => {
    const r = await post({ condicionId: 'r11', precioContado: 1000, clienteEspecial: true })
    const j = await r.json()
    expect(j).toMatchObject({ estado: 'consultar' })
  })

  it('falta precio → 422', async () => {
    const r = await post({ condicionId: 'r11' })
    expect(r.status).toBe(422)
    expect(await r.json()).toMatchObject({ estado: 'falta_precio', cual: 'contado' })
  })

  it('método inexistente → 422 metodo_invalido', async () => {
    const r = await post({ condicionId: 'r99', precioContado: 1000 })
    expect(r.status).toBe(422)
    expect(await r.json()).toMatchObject({ estado: 'metodo_invalido' })
  })

  it('GET no permitido → 405', async () => {
    process.env.API_TOKEN = 'secreto-test'
    const r = await handler(new Request('https://x/api/precio', { method: 'GET' }))
    expect(r.status).toBe(405)
  })
})
