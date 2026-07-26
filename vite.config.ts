import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Repo is github.com/eulxo231/- → Pages URL is /-/
const base = process.env.GITHUB_ACTIONS ? '/-/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
})
