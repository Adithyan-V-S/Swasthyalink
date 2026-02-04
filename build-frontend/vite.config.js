import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-icon-512.png'],
      manifest: {
        name: 'Swasthyalink - Digital Healthcare',
        short_name: 'Swasthyalink',
        description: 'Secure digital healthcare platform connecting patients, doctors, and families.',
        theme_color: '#3b82f6',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-icon-512.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000 // 5MB
      }
    })
  ],
  server: {
    port: 5174, // Match the port configured in Google OAuth
    strictPort: true, // Fail if port is not available
    // Remove COOP headers to allow Google OAuth popup
    // headers: {
    //   'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    //   'Cross-Origin-Embedder-Policy': 'unsafe-none'
    // },
    proxy: {
      '/api': {
        target: process.env.NODE_ENV === 'production'
          ? 'https://swasthyalink-backend-v2.onrender.com'
          : 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
