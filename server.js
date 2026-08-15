const { createServer } = require('http')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
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
