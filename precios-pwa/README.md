# MG Precios — PWA

Calculadora de precios diferenciados para vendedores. Funciona 100 % offline una vez instalada.

## Requisitos

- Node.js ≥ 18
- Yarn 1.x (`npm install -g yarn`)

## Desarrollo local

```bash
yarn install
yarn dev
```

Abre `http://localhost:5173` en el navegador.

## Build de producción

```bash
yarn build
```

El output queda en `dist/`. Para previsualizar:

```bash
yarn preview
```

## Tests

```bash
yarn test
```

## Deploy

### Vercel

1. Conectá el repo desde [vercel.com](https://vercel.com).
2. Vercel detecta Vite automáticamente (framework preset: Vite).
3. En **Settings → Environment Variables** agregá:
   - `VITE_PASS_HASH` = el hash SHA-256 del password (ver sección Password).
4. Push a `main` → deploy automático.

### Netlify

1. Conectá el repo desde [app.netlify.com](https://app.netlify.com).
2. Build command: `yarn build`, publish directory: `dist` (ya en `netlify.toml`).
3. En **Site settings → Environment variables** agregá:
   - `VITE_PASS_HASH` = el hash SHA-256 del password.
4. Push a `main` → deploy automático.

> **Importante:** `VITE_PASS_HASH` se setea solo en el panel del proveedor. Nunca se commitea al repo.

## Cambiar password

1. Generá el nuevo hash SHA-256. Ejemplo en terminal:

   ```bash
   echo -n "mi-nuevo-password" | shasum -a 256
   ```

   O en Node:

   ```js
   const crypto = require('crypto');
   console.log(crypto.createHash('sha256').update('mi-nuevo-password').digest('hex'));
   ```

2. Copiá el hash resultante.
3. Andá al panel de tu proveedor (Vercel / Netlify) → Environment Variables.
4. Actualizá el valor de `VITE_PASS_HASH` con el nuevo hash.
5. Hacé redeploy (en Vercel: Deployments → Redeploy; en Netlify: Deploys → Trigger deploy).

## Instalar PWA en celulares

### Android (Chrome)

1. Abrí la URL del sitio en Chrome.
2. Esperá unos segundos → aparece un banner "Agregar a pantalla de inicio". Si no aparece:
   - Tocá los **tres puntos** (⋮) arriba a la derecha.
   - Seleccioná **"Agregar a pantalla de inicio"** o **"Instalar aplicación"**.
3. Confirmá tocando **"Instalar"**.
4. La app aparece como ícono en el launcher, se abre sin barra del navegador y funciona offline.

### iOS (Safari)

1. Abrí la URL del sitio **en Safari** (no Chrome ni otro navegador).
2. Tocá el botón **Compartir** (cuadrado con flecha ↑) en la barra inferior.
3. En el menú, buscá **"Agregar a la pantalla de inicio"** (scrolleá si no lo ves).
4. Ponele nombre (viene pre-cargado "MG Precios") y tocá **"Agregar"**.
5. La app aparece como ícono en el home screen, se abre a pantalla completa y funciona offline.

> **Nota:** En iOS, la primera vez que abrís la app instalada necesitás conexión para que el service worker cachee los archivos. Después funciona offline.

## Offline

Una vez instalada, la app cachea todo el código y los datos de reglas de precios. La calculadora funciona sin conexión a internet. Cuando haya una nueva versión deployada, el service worker la actualiza automáticamente al volver a tener conexión.

## Estructura del proyecto

```
precios-pwa/
├── public/             # Íconos PWA, favicon, SVG sprites
├── src/
│   ├── components/     # Componentes reutilizables
│   ├── data/           # rules.json (reglas de precios)
│   ├── lib/            # Lógica de cálculo + tests
│   ├── pages/          # Calculadora (página principal)
│   ├── App.tsx         # Entry component
│   ├── main.tsx        # React root
│   └── index.css       # Tailwind import
├── vercel.json         # SPA fallback para Vercel
├── netlify.toml        # Build + SPA fallback para Netlify
├── vite.config.ts      # Vite + PWA + Tailwind
└── package.json
```
