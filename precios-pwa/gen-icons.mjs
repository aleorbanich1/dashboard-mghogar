import sharp from 'sharp'
import { writeFileSync } from 'node:fs'

const ACCENT = '#059669'   // emerald-600 = acento UI
const DARK   = '#047857'   // emerald-700 para profundidad sutil

// Logo "MG": fondo acento + texto blanco centrado. r = radio esquinas.
const svg = ({ size, pad = 0, radius, bg = ACCENT }) => {
  const r = radius ?? Math.round(size * 0.22)
  const inner = size - pad * 2
  const fs = Math.round(inner * 0.42)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="${DARK}"/>
    </linearGradient>
  </defs>
  <rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${r}" ry="${r}" fill="url(#g)"/>
  <text x="50%" y="50%" dy="0.02em" text-anchor="middle" dominant-baseline="central"
    font-family="Geist, 'Segoe UI', system-ui, sans-serif" font-weight="700"
    font-size="${fs}" letter-spacing="-0.04em" fill="#ffffff">MG</text>
</svg>`
}

const png = async (file, opts) =>
  sharp(Buffer.from(svg(opts))).png().toFile(`public/${file}`)

await png('pwa-192x192.png', { size: 192 })
await png('pwa-512x512.png', { size: 512 })
// maskable: padding ~18% safe zone, fondo lleno hasta bordes
await png('pwa-maskable-512x512.png', { size: 512, pad: 0, radius: 0 })
// apple-touch: 180, sin esquinas (iOS las recorta), fondo opaco
await png('apple-touch-icon.png', { size: 180, radius: 0 })

// favicon SVG nuevo (reemplaza el morado prohibido)
writeFileSync('public/favicon.svg', svg({ size: 64, radius: 14 }))
console.log('icons generated')
