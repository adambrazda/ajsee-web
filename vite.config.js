import { defineConfig } from 'vite';

export default defineConfig({
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
