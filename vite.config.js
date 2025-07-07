import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        about: 'about.html',
        events: 'events.html',
        partners: 'partners.html',
      }
    }
  },
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
