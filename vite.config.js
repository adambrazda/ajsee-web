// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';
import { existsSync, createReadStream } from 'fs';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Helper: přidej vstup jen když existuje
function addIfExists(obj, key, filepath) {
  if (existsSync(filepath)) obj[key] = filepath;
  return obj;
}

// Dev-only middleware: přesměruj staré cesty bez /src/
function devRedirectPlugin() {
  return {
    name: 'ajsee-dev-redirect-src-modules',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/main.js') {
          res.statusCode = 302;
          res.setHeader('Location', '/src/main.js');
          return res.end();
        }
        if (req.url === '/homepage-blog.js') {
          res.statusCode = 302;
          res.setHeader('Location', '/src/homepage-blog.js');
          return res.end();
        }
        next();
      });
    }
  };
}

// ⬇⬇ DŮLEŽITÉ: v devu obslouží /locales/* ze src/locales/*
function devLocalesAlias() {
  return {
    name: 'ajsee-dev-locales-alias',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        if (!req.url.startsWith('/locales/')) return next();

        const filePath = resolve(
          __dirname,
          'src',
          req.url.replace(/^\/locales\//, 'locales/')
        );
        if (existsSync(filePath)) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          createReadStream(filePath).pipe(res);
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  appType: 'mpa',

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@styles': resolve(__dirname, 'src/styles'),
    },
  },

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
          microguides: resolve(__dirname, 'microguides/index.html'),
        };
        addIfExists(inputs, 'coming-soon', resolve(__dirname, 'coming-soon/index.html'));
        addIfExists(inputs, 'coming-soon-thanks', resolve(__dirname, 'coming-soon/thanks.html'));
        return inputs;
      })(),
    },
  },

  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  plugins: [
    // dev utility
    devRedirectPlugin(),
    devLocalesAlias(),

    // build: zkopíruj locales + microguides do dist/
    viteStaticCopy({
      targets: [
        { src: 'src/locales/**/*', dest: 'locales' },
        { src: 'content/microguides/**/*', dest: 'content/microguides' },
      ],
    }),
  ],
});
