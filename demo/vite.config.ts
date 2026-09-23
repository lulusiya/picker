import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import picker from 'vite-plugin-picker'

export default defineConfig({
  plugins: [picker(), vue()],
})
