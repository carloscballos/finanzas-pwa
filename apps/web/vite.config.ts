import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Finanzas',
        short_name: 'Finanzas',
        description: 'App de finanzas personales',
        theme_color: '#a63d1c',
        background_color: '#f2efe3',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Handlers de Web Push (public/push-sw.js). Al ser importScripts, el
        // navegador lo revisa byte a byte en cada chequeo de actualización del SW.
        importScripts: ['push-sw.js'],
      },
    }),
  ],
  server: {
    port: 5173,
  },
})
