import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: resolve(__dirname, 'electron/main.ts') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: resolve(__dirname, 'electron/preload.ts') } }
  },
  renderer: {
    root: resolve(__dirname, 'src/ui'),
    build: { rollupOptions: { input: resolve(__dirname, 'src/ui/index.html') } },
    plugins: [react()]
  }
})
