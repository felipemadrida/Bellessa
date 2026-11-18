import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Puertos de desarrollo de Bellessa.
 *
 * Se eligieron para no chocar con otros proyectos locales que ya ocupan
 * 3000, 5173, 8000 y 8010. Todos se pueden sobreescribir por entorno:
 *   BELLESSA_WEB_PORT       (dev)      por defecto 5180
 *   BELLESSA_WEB_PREVIEW    (preview)  por defecto 4180
 *   BELLESSA_API_PORT       (API)      por defecto 8011
 */
const WEB_PORT = Number(process.env.BELLESSA_WEB_PORT ?? 5180)
const PREVIEW_PORT = Number(process.env.BELLESSA_WEB_PREVIEW ?? 4180)
const API_TARGET = `http://127.0.0.1:${process.env.BELLESSA_API_PORT ?? 8011}`

const proxy = {
  '/api': {
    target: API_TARGET,
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: WEB_PORT,
    // Falla en vez de saltar a otro puerto: evita quedar servido en un puerto
    // inesperado sin darse cuenta.
    strictPort: true,
    proxy,
  },
  preview: {
    host: '127.0.0.1',
    port: PREVIEW_PORT,
    strictPort: true,
    proxy,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
