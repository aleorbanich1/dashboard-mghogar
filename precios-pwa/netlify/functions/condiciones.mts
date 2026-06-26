// GET /api/condiciones  (Netlify Function)
// Lista los métodos de pago válidos (id + label) para que el flujo de ManyChat
// sepa qué "condicionId" / "metodo" puede enviar a POST /api/precio.
//
// Auth: header  Authorization: Bearer <API_TOKEN>   (o  x-api-key: <API_TOKEN>)

import rules from '../../src/data/rules.json'
import { authorize, json, preflight } from './_lib/api'

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return preflight()

  const denied = authorize(req)
  if (denied) return denied

  const condiciones = (
    rules as { id: string; label: string; base: string; haberes?: boolean }[]
  ).map((r) => ({
    id: r.id,
    label: r.label,
    base: r.base,
    requiereDatosHaberes: r.haberes === true,
  }))

  return json({ ok: true, condiciones })
}

export const config = { path: '/api/condiciones' }
