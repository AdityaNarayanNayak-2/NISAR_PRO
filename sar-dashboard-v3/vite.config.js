import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitLab Pages serves from /nisar_pro/ subpath
  // Set via env var so dev mode uses / and CI uses /nisar_pro/
  base: process.env.GITLAB_PAGES === 'true' ? '/nisar_pro/' : '/',
})
