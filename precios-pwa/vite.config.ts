/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// theme_color = acento UI (emerald-600). background = neutro slate-900.
const ACCENT = '#059669'
const BACKGROUND = '#0f172a'

export default defineConfig({
  // Puerto fijo para que el origin (localhost:4173) no cambie entre
  // ejecuciones → la sesion de Supabase guardada en localStorage persiste y
  // solo hay que iniciar sesion una vez.
  preview: {
    port: 4173,
    strictPort: true,
    host: '127.0.0.1',
    allowedHosts: ['.ngrok-free.dev'], // Permite túneles de ngrok en preview
  },
  server: {
    port: 4173,
    strictPort: true,
    host: '127.0.0.1',
    allowedHosts: ['.ngrok-free.dev'], // Permite túneles de ngrok en dev
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'MG Precios',
        short_name: 'MG Precios',
        description: 'Calculadora de precios diferenciados',
        lang: 'es',
        theme_color: ACCENT,
        background_color: BACKGROUND,
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell: precachea todo el build (JS/CSS/HTML/iconos) → la
        // calculadora funciona offline porque las reglas de precio son estaticas.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
