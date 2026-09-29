/* The whole backend: static files + three tiny endpoints, on Node's own http
   and sqlite modules. No framework, no dependencies.

   GET  /api/visit            → { count }
   POST /api/visit            → { count } (counts a new visitor)
   GET  /api/guestbook        → { entries: [{ name, bits, at }] } (approved only)
   POST /api/guestbook        → { ok } (stored as pending)
   POST /api/contact          → { ok } (stored; forwarded to CONTACT_WEBHOOK_URL if set)
   GET  /api/admin/guestbook?token=…            → pending + approved entries
   POST /api/admin/guestbook?token=… {id, action: approve|delete}

   Env: PORT (3000), DATA_DIR (./server/data), ADMIN_TOKEN, CONTACT_WEBHOOK_URL,
        STATIC_DIR (./dist). With DEV=1 only the API is served (Vite serves the rest). */

import { createServer } from 'node:http'
import { readFile, stat, mkdir } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join, extname, normalize, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
// in dev the API sits behind Vite's proxy on its own port, whatever PORT says
const PORT = Number(process.env.DEV ? (process.env.API_PORT ?? 8787) : (process.env.PORT ?? 3000))
const DATA = resolve(process.env.DATA_DIR ?? join(here, 'data'))
const STATIC = resolve(process.env.STATIC_DIR ?? join(here, '..', 'dist'))
const DEV = !!process.env.DEV
const ADMIN = process.env.ADMIN_TOKEN ?? ''
const HOOK = process.env.CONTACT_WEBHOOK_URL ?? ''

await mkdir(DATA, { recursive: true })
const db = new DatabaseSync(join(DATA, 'site.db'))
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY CHECK (id = 1), n INTEGER NOT NULL);
  INSERT OR IGNORE INTO counter (id, n) VALUES (1, 0);
  CREATE TABLE IF NOT EXISTS marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    bits TEXT NOT NULL,
    approved INTEGER NOT NULL DEFAULT 0,
    at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

const q = {
  count: db.prepare('SELECT n FROM counter WHERE id = 1'),
  bump: db.prepare('UPDATE counter SET n = n + 1 WHERE id = 1 RETURNING n'),
  approved: db.prepare('SELECT name, bits, at FROM marks WHERE approved = 1 ORDER BY id LIMIT 400'),
  all: db.prepare('SELECT id, name, bits, approved, at FROM marks ORDER BY id DESC LIMIT 500'),
  addMark: db.prepare('INSERT INTO marks (name, bits) VALUES (?, ?)'),
  approve: db.prepare('UPDATE marks SET approved = 1 WHERE id = ?'),
  remove: db.prepare('DELETE FROM marks WHERE id = ?'),
  addMsg: db.prepare('INSERT INTO messages (name, email, message) VALUES (?, ?, ?)'),
}

/* in-memory rate limits: key → timestamps */
const hits = new Map()
function limited(key, max, windowMs) {
  const now = Date.now()
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  list.push(now)
  hits.set(key, list)
  if (hits.size > 5000) hits.clear()
  return list.length > max
}

const ipOf = (req) => (req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').toString().split(',')[0].trim()

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers })
  res.end(data)
}

async function readJson(req, max = 16_000) {
  let size = 0
  const chunks = []
  for await (const c of req) {
    size += c.length
    if (size > max) throw new Error('too large')
    chunks.push(c)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    return {}
  }
}

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n)

async function api(req, res, url) {
  const ip = ipOf(req)
  if (url.pathname === '/api/visit') {
    if (req.method === 'POST') {
      if (limited(`v:${ip}`, 3, 3_600_000)) return send(res, 200, { count: q.count.get().n })
      return send(res, 200, { count: q.bump.get().n })
    }
    return send(res, 200, { count: q.count.get().n })
  }

  if (url.pathname === '/api/guestbook') {
    if (req.method === 'GET') return send(res, 200, { entries: q.approved.all() }, { 'cache-control': 'public, max-age=30' })
    if (req.method !== 'POST') return send(res, 405, { ok: false })
    const body = await readJson(req)
    if (body.website) return send(res, 200, { ok: true }) // honeypot
    const name = clean(body.name, 24)
    const bits = String(body.bits ?? '')
    if (!name || !/^[01]{64}$/.test(bits) || !bits.includes('1')) return send(res, 400, { ok: false, error: 'invalid' })
    if (limited(`g:${ip}`, 3, 3_600_000)) return send(res, 429, { ok: false, error: 'rate' })
    q.addMark.run(name, bits)
    return send(res, 200, { ok: true })
  }

  if (url.pathname === '/api/contact') {
    if (req.method !== 'POST') return send(res, 405, { ok: false })
    const body = await readJson(req)
    if (body.website) return send(res, 200, { ok: true })
    const name = clean(body.name, 80)
    const email = clean(body.email, 160)
    const message = String(body.message ?? '').trim().slice(0, 4000)
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !message) return send(res, 400, { ok: false, error: 'invalid' })
    if (limited(`c:${ip}`, 4, 3_600_000)) return send(res, 429, { ok: false, error: 'rate' })
    q.addMsg.run(name, email, message)
    if (HOOK) {
      fetch(HOOK, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Discord and Slack-style webhooks both accept `content` / `text`
        body: JSON.stringify({ content: `New message from ${name} <${email}>\n\n${message}`, text: `New message from ${name} <${email}>\n\n${message}` }),
      }).catch(() => {})
    }
    return send(res, 200, { ok: true })
  }

  if (url.pathname === '/api/admin/guestbook') {
    if (!ADMIN || url.searchParams.get('token') !== ADMIN) return send(res, 403, { ok: false })
    if (req.method === 'GET') return send(res, 200, { entries: q.all.all() })
    const body = await readJson(req)
    const id = Number(body.id)
    if (body.action === 'approve') q.approve.run(id)
    else if (body.action === 'delete') q.remove.run(id)
    return send(res, 200, { ok: true })
  }

  return send(res, 404, { ok: false })
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.ico': 'image/x-icon',
}

async function file(res, path, status = 200) {
  const s = await stat(path)
  const hashed = /\/assets\//.test(path)
  res.writeHead(status, {
    'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
    'content-length': s.size,
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  })
  createReadStream(path).pipe(res)
}

async function statics(req, res, url) {
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
  let path = join(STATIC, rel)
  if (!path.startsWith(STATIC)) return send(res, 403, 'forbidden')
  try {
    const s = await stat(path)
    if (s.isDirectory()) path = join(path, 'index.html')
    await stat(path)
    return file(res, path)
  } catch {
    // client routes of the main site fall back to its shell
    const shell = /^\/(work\/[\w-]+|cv|colophon|lab|sandbox)\/?$/.test(url.pathname) ? join(STATIC, 'index.html') : null
    if (shell) return file(res, shell)
    try {
      await readFile(join(STATIC, 'index.html'))
      return file(res, join(STATIC, 'index.html'), 404)
    } catch {
      return send(res, 404, 'not found')
    }
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://local')
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url)
    if (DEV) return send(res, 404, { ok: false })
    return await statics(req, res, url)
  } catch (e) {
    console.error(e)
    if (!res.headersSent) send(res, 500, { ok: false })
    else res.end()
  }
}).listen(PORT, () => console.log(`site on :${PORT}${DEV ? ' (api only)' : ''}`))
