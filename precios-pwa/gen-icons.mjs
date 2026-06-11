import sharp from 'sharp'

// Fuente: logo real de la marca (.mg hogar). Alpha transparente en esquinas
// → se compone sobre fondo blanco para iconos cuadrados nitidos.
const SRC = 'public/logo-mghogar.png'
const BG = { r: 0, g: 0, b: 0, alpha: 0 } // transparente

// Compone el logo centrado en un cuadrado de lado `size`, con `pad` px de
// margen por lado (safe zone). Devuelve un PNG.
const icon = async (file, { size, pad = Math.round(size * 0.12) }) => {
  const inner = size - pad * 2
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(`public/${file}`)
}

await icon('pwa-192x192.png', { size: 192 })
await icon('pwa-512x512.png', { size: 512 })
// maskable: ~18% safe zone, fondo lleno hasta bordes
await icon('pwa-maskable-512x512.png', { size: 512, pad: Math.round(512 * 0.18) })
// apple-touch: 180, iOS recorta esquinas → fondo opaco hasta el borde
await icon('apple-touch-icon.png', { size: 180, pad: Math.round(180 * 0.1) })
// favicon: cuadrado pequeno para la pestana del navegador
await icon('favicon.png', { size: 64, pad: 6 })

console.log('icons generated from', SRC)
