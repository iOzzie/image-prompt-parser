import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Change this to match your EXACT repository name
  base: '/comfyui-image-parser/', 
})
