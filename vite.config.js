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
    apply: 'serve',
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
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/locales/')) return next();
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

/**
 * DEV HTML rewrite:
 * - pokud jsou ve stránkách natvrdo /assets/*.js (build výstup),
 *   v DEV to přepíšeme na /src/*.js, aby Vite HMR a modulový graf fungoval.
 * - CSS linky z /assets/ v DEV zahodíme (Vite si je injektuje sám).
 */
function devHtmlRewriteAssetsPlugin() {
  return {
    name: 'ajsee-dev-rewrite-assets-to-src',
    apply: 'serve',
    transformIndexHtml(html, ctx) {
      const mappings = [
        {
          re: /<script[^>]+src="\/assets\/main-[^"]+\.js"[^>]*><\/script>/g,
          replace: '<script type="module" src="/src/main.js"></script>'
        },
        {
          re: /<script[^>]+src="\/assets\/events-home-[^"]+\.js"[^>]*><\/script>/g,
          replace: '<script type="module" src="/src/events-home.js"></script>'
        },
        {
          re: /<script[^>]+src="\/assets\/modulepreload-polyfill-[^"]+\.js"[^>]*><\/script>/g,
          replace: ''
        },
        {
          re: /<link[^>]+rel="stylesheet"[^>]+href="\/assets\/[^"]+\.css"[^>]*>/g,
          replace: ''
        }
      ];
      let out = html;
      for (const { re, replace } of mappings) out = out.replace(re, replace);
      return out;
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
          accommodation: resolve(__dirname, 'accommodation.html'), // ✅ DOPLNĚNO
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
        ws: true,
      },
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },

  plugins: [
    devRedirectPlugin(),
    devLocalesAlias(),
    devHtmlRewriteAssetsPlugin(),

    viteStaticCopy({
      targets: [
        { src: 'src/locales/**/*', dest: 'locales' },
        { src: 'content/microguides/**/*', dest: 'content/microguides' },
      ],
    }),
  ],
});
