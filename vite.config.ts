import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // For GitHub Pages deployment - update 'Recipeh-P-S' if your repo name differs
  base: process.env.NODE_ENV === 'production' ? '/Recipeh-P-S/' : '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
