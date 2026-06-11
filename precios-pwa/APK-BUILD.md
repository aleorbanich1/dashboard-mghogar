# Generar APK (TWA liviana) — MG Precios

PWA empaquetada como **Trusted Web Activity**: shell Android delgado que reusa el
motor Chrome del dispositivo. APK ~1-2 MB, bajo consumo RAM/CPU. Corre en cualquier
Android moderno (requiere Chrome o Android System WebView instalado — viene de fábrica).

- URL PWA: https://panelmghogar.netlify.app
- Package ID: `app.netlify.panelmghogar` (DEBE coincidir con `public/.well-known/assetlinks.json`)

---

## Paso 1 — Generar el paquete en PWABuilder

1. Ir a https://www.pwabuilder.com
2. Pegar `https://panelmghogar.netlify.app` → **Start**.
3. Esperar el análisis (manifest + service worker + iconos ya cumplen).
4. **Package For Stores** → pestaña **Android**.
5. En opciones:
   - **Package ID**: `app.netlify.panelmghogar`  ← exacto, no cambiar.
   - **App name**: MG Precios
   - **Signing key**: *Create new* (primera vez).
6. **Download** → baja un `.zip`.

> ⚠️ Guardar el `.zip` y la **clave de firma** (`signing.keystore` + contraseñas
> dentro del zip) en lugar seguro. Sin esa misma clave NO se pueden publicar
> actualizaciones futuras del APK.

---

## Paso 2 — Activar verificación (quitar barra de URL)

El zip incluye un `assetlinks.json` con el **SHA256 fingerprint** de tu clave.

1. Abrir ese `assetlinks.json` del zip.
2. Copiar el valor de `sha256_cert_fingerprints` (ej: `AB:CD:12:...`).
3. Pasármelo → lo pego en `public/.well-known/assetlinks.json` y hago push.
4. Netlify redeploya → la verificación Digital Asset Links pasa → el APK abre
   **sin barra de navegador** (se ve como app nativa).

> Si no se hace este paso, el APK funciona igual pero muestra una barra de URL arriba.

---

## Paso 3 — Instalar en Android

Dentro del zip hay 2 archivos:

| Archivo | Uso |
|---------|-----|
| `app-release-signed.apk` | **Instalar directo** en cualquier dispositivo. |
| `app-release-bundle.aab` | Solo para subir a Google Play Store. |

Instalación directa del `.apk`:

1. Pasar el `.apk` al teléfono (USB, Drive, WhatsApp, email).
2. Tocar el archivo → Android pide permitir **"instalar apps de origen desconocido"** → activar.
3. Instalar → abre como app nativa, pantalla completa, offline (la calculadora
   ya cachea con el service worker).

---

## Notas de rendimiento

- APK no empaqueta Chromium → por eso pesa ~1-2 MB y no exige hardware potente.
- La UI corre en el WebView/Chrome del sistema → mismo rendimiento que abrir la web.
- Funciona offline tras la primera carga (service worker precachea el app shell).
