import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    strategies: 'injectManifest',
    srcDir: 'src/workers',
    filename: 'sw.js',
    includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],
    manifest: {
      name: 'The Rustic Vine',
      short_name: 'Rustic Vine',
      description: 'Faith-based handmade craft kits — live craft-alongs, exclusive kits, and VIP community.',
      theme_color: '#6B2D3E',
      background_color: '#FAF7F2',
      display: 'standalone',
      orientation: 'portrait-primary',
      start_url: '/',
      scope: '/',
      icons: [
        {
          src: '/icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: '/icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: '/icons/apple-touch-icon.png',
          sizes: '180x180',
          type: 'image/png',
        },
      ],
    },
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    },
    devOptions: {
      enabled: true,
      type: 'module',
    },
  }), cloudflare()],
  server: {
    port: 5173,
  },
})