// vite.config.js
import { defineConfig } from 'vite'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// Helper: přidej vstup jen když existuje
function addIfExists(obj, key, filepath) {
  if (existsSync(filepath)) obj[key] = filepath
  return obj
}

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@styles': resolve(__dirname, 'src/styles'),
    },
  },

  // ⚠️ Záměrně bez css.preprocessorOptions.scss.additionalData
  // -> používáme explicitní `@use` v SCSS souborech

  build: {
    rollupOptions: {
      input: (() => {
        const inputs = {
          main: resolve(__dirname, 'index.html'),
          about: resolve(__dirname, 'about.html'),
          events: resolve(__dirname, 'events.html'),
          partners: resolve(__dirname, 'partners.html'),
          thankyou: resolve(__dirname, 'thank-you.html'),
          blog: resolve(__dirname, 'blog.html'),
          'blog-detail': resolve(__dirname, 'blog-detail.html'),
          faq: resolve(__dirname, 'faq.html'),
        }

        // Přidej waitlist stránky jen pokud nejsou v /public
        addIfExists(inputs, 'coming-soon', resolve(__dirname, 'coming-soon/index.html'))
        addIfExists(inputs, 'coming-soon-thanks', resolve(__dirname, 'coming-soon/thanks.html'))

        return inputs
      })(),
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },

  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'src/locales/*.json', dest: 'locales' },
        // Pozn.: cokoliv v /public se kopíruje automaticky
      ],
    }),
  ],
})
