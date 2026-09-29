import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { home, bar } from './src/a/templates.ts'

/* Prerender the Stack's content into index.html so the page is readable
   before (and without) JavaScript, and crawlers see real text. */
function prerender(): Plugin {
  return {
    name: 'prerender-home',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (!ctx.filename.endsWith(resolve(import.meta.dirname, 'index.html'))) return html
        return html.replace('<!--bar-->', bar()).replace('<!--app-->', home())
      },
    },
  }
}

export default defineConfig({
  plugins: [prerender()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: {
    target: 'es2022',
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        screen: resolve(import.meta.dirname, 'screen/index.html'),
        board: resolve(import.meta.dirname, 'board/index.html'),
      },
    },
  },
})
