import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import pickAi from 'vite-plugin-pick-ai'

export default defineConfig({
  plugins: [pickAi({ openInEditor: false, targets: ['pi', 'codex'] }), vue()],
})
