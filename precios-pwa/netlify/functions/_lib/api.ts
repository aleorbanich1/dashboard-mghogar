// Helpers compartidos por las Netlify Functions (auth + CORS + JSON).
// Runtime: Netlify Functions (Web API: Request/Response).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-api-key',
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  })
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS })
}

// Comparación en tiempo constante (evita timing attacks sobre el token).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Extrae el token de "Authorization: Bearer <t>" o del header "x-api-key".
function extractToken(req: Request): string | null {
  const auth = req.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim()
  const key = req.headers.get('x-api-key')
  return key ? key.trim() : null
}

// Token de servidor. En Netlify se configura como variable de entorno API_TOKEN
// (Site settings → Environment variables). Local: archivo .env / .dev.vars.
function serverToken(): string | undefined {
  return process.env.API_TOKEN
}

// Devuelve null si autoriza; o una Response 401/500 si no.
export function authorize(req: Request): Response | null {
  const expected = serverToken()
  if (!expected) {
    return json({ error: 'API_TOKEN no configurado en el servidor' }, 500)
  }
  const token = extractToken(req)
  if (!token || !safeEqual(token, expected)) {
    return json({ error: 'No autorizado' }, 401)
  }
  return null
}
