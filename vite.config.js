import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'about.html', dest: '' },
        { src: 'events.html', dest: '' },
        { src: 'partners.html', dest: '' }
      ]
    })
  ],
  css: {
    preprocessorOptions: {
      scss: {}
    }
  },
  server: {
    open: true,
    port: 3000
  }
});
