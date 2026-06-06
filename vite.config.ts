import { defineConfig } from 'vite'

// Relative base so the build works inside a Capacitor webview (file:// origin)
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 0,
  },
})
