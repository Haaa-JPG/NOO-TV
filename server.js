const { createServer } = require('http')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.RENDER ? '127.0.0.1' : '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

const MAX_BODY_SIZE = 10 * 1024 * 1024

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const contentLength = parseInt(req.headers['content-length'] || '0', 10)
      if (contentLength > MAX_BODY_SIZE) {
        res.statusCode = 413
        res.end('Request entity too large')
        return
      }

      await handle(req, res)
    } catch (err) {
      console.error('Request error:', err)
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  })
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`)

      if (process.env.ENABLE_WORKER === 'true') {
        const { startWorker } = require('./scripts/worker')
        startWorker()
      }

      if (process.env.ENABLE_CRON === 'true') {
        const { startCron } = require('./scripts/cron')
        startCron()
      }
    })
})
