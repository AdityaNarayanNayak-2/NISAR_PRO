import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
function resolveBase() {
  // CI deployments use subpath; local dev uses root
  if (process.env.GITHUB_PAGES === 'true') return '/NISAR_PRO/';
  if (process.env.GITLAB_PAGES === 'true') return '/nisar_pro/';
  return '/';
}

export default defineConfig({
  plugins: [react()],
  base: resolveBase(),
})
