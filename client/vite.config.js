import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// L'interface (dev) tourne sur le port 3000 et proxifie /api vers l'API (3001).
// En production : `npm run build` génère dist/ servi par le serveur Express.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
