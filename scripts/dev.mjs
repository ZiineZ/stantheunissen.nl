/* Vite for the site, plus the API server in watch mode. One command.
   If something already answers on the API port (another dev session),
   reuse it instead of crashing. */
import { spawn } from 'node:child_process'
import { connect } from 'node:net'

const API_PORT = Number(process.env.API_PORT ?? 8787)

const busy = await new Promise((done) => {
  const s = connect(API_PORT, '127.0.0.1')
  s.once('connect', () => (s.destroy(), done(true)))
  s.once('error', () => done(false))
})

let api = null
if (busy) console.log(`API already running on :${API_PORT}, reusing it`)
else {
  api = spawn(process.execPath, ['--watch', '--no-warnings', 'server/index.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, DEV: '1', API_PORT: String(API_PORT), ADMIN_TOKEN: process.env.ADMIN_TOKEN ?? 'dev' },
  })
}
const vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', ...process.argv.slice(2)], { stdio: 'inherit' })
const stop = () => {
  api?.kill()
  vite.kill()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
vite.on('exit', (code) => {
  api?.kill()
  process.exit(code ?? 0)
})
