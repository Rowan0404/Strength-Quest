import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Strength-Quest/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Strength Quest (Wizard Training)',
        short_name: 'Strength Quest',
        description: 'Offline, device-only tracker for phased strength, core, cardio, meals, and habits.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/Strength-Quest/',
        icons: [
          {
            src: '/Strength-Quest/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,webmanifest}']
      }
    })
  ]
})
