import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
