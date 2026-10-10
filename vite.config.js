import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Revealcard',
        short_name: 'Revealcard',
        description: '가리고, 기억하고, 확인하는 카드 학습',
        theme_color: '#f8f7f4',
        background_color: '#f8f7f4',
        display: 'standalone',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/club(?:\/|$)/],
        runtimeCaching: [{
          urlPattern: ({ url }) => /^\/api\/images\/[0-9a-f-]{36}\.(?:png|jpg|webp)$/.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'card-images', expiration: { maxEntries: 200 }, cacheableResponse: { statuses: [200] } },
        }],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: false,
      },
    },
  },
  preview: {
    allowedHosts: ['revealcard.kobyte01server.me'],
  },
})
