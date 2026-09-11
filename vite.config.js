import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Local/dev default `/`. CI / `npm run build:gh` sets BASE_PATH=/journey-world/. */
const base = process.env.BASE_PATH ?? '/'

const CDN = {
  react: 'https://cdn.jsdelivr.net/npm/react@19.2.8/+esm',
  'react-dom': 'https://cdn.jsdelivr.net/npm/react-dom@19.2.8/+esm',
  'react-dom/client': 'https://cdn.jsdelivr.net/npm/react-dom@19.2.8/client/+esm',
}

function spaFallback() {
  return {
    name: 'spa-github-pages-fallback',
    closeBundle() {
      const index = resolve('dist/index.html')
      if (existsSync(index)) {
        copyFileSync(index, resolve('dist/404.html'))
      }
    },
  }
}

/** Load React from jsDelivr via import map (keeps Vite ESM output). */
function reactCdn() {
  return {
    name: 'react-cdn',
    apply: 'build',
    config() {
      return {
        build: {
          rollupOptions: {
            external: Object.keys(CDN),
          },
        },
      }
    },
    transformIndexHtml(html) {
      const importMap = `<script type="importmap">${JSON.stringify({ imports: CDN })}</script>`
      return html.replace(/<head>/, `<head>\n    ${importMap}`)
    },
  }
}

export default defineConfig({
  base,
  plugins: [
    react(),
    reactCdn(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Journey World · 旅程',
        short_name: '旅程',
        description: '可嵌套的旅游攻略 / 人生旅程',
        theme_color: '#1a3a2f',
        background_color: '#f3efe6',
        display: 'standalone',
        lang: 'zh-CN',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2,png,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'jsdelivr-cdn',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    spaFallback(),
  ],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router')) return 'router'
            if (id.includes('react-vertical-timeline')) return 'timeline'
          }
        },
      },
    },
  },
})
