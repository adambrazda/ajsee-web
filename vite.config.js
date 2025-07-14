import { defineConfig } from 'vite'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        events: resolve(__dirname, 'events.html'),
        partners: resolve(__dirname, 'partners.html'),
        thankyou: resolve(__dirname, 'thank-you.html')
      }
    }
  },
   plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'src/locales/*.json',
          dest: 'locales' // zkopíruje do public/dist/locales/
        }
      ]
    })
  ]
})