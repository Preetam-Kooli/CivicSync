import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // listen on all network interfaces, so phones can connect
    // In development, forward /api requests to our Express server
    proxy: { '/api': 'http://localhost:5000' },
  },
})