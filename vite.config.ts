import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { ProxyOptions } from 'vite'

import { cloudflare } from "@cloudflare/vite-plugin";

// The motogp.com API rejects requests carrying a browser Origin header (403),
// so the dev/preview server proxies it and strips the identifying headers.
const motogpProxy: Record<string, ProxyOptions> = {
  '/api/motogp': {
    target: 'https://api.motogp.pulselive.com/motogp/v1',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/motogp/, ''),
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('origin')
        proxyReq.removeHeader('referer')
        proxyReq.removeHeader('cookie')
      })
    },
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  server: { proxy: motogpProxy },
  preview: { proxy: motogpProxy },
})