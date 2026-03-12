import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Strength Quest (Wizard Training)',
        short_name: 'Strength Quest',
        description: 'Offline, device-only tracker for phased strength + daily core.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,json}'] }
    })
  ]
});
