import { resolve } from 'node:path'
import { createApp } from './app.js'

const app = await createApp({
  dataFile: resolve(process.env.DATA_FILE || '.data/revealcard.json'),
  distDir: resolve('dist'),
  secureCookies: process.env.COOKIE_SECURE === '1',
})
const port = Number(process.env.PORT || 3001)
const host = process.env.HOST || '0.0.0.0'
app.listen(port, host, () => console.log(`Revealcard server: http://localhost:${port}`))
