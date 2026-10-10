import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Base path matches the GitHub repo name, since GitHub Pages serves
// project sites from https://<user>.github.io/<repo>/
// `npm run dev:phone` serves over HTTPS (self-signed): phones only allow the
// camera on secure origins, so the scanner needs it for LAN testing.
export default defineConfig(({ mode }) => ({
  base: '/homestack/',
  plugins: [
    react(),
    mode === 'phone' && basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Precache the bundled Inter font too, so the basement (no signal) gets the real typeface.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
      manifest: {
        name: 'HomeStack',
        short_name: 'HomeStack',
        description: 'Find anything in your basement and storage rooms, offline.',
        start_url: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#000000',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
}))
