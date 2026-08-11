import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth'
import teamsRoutes from './routes/teams'
import findingsRoutes from './routes/findings'
import membersRoutes from './routes/members'
import policiesRoutes from './routes/policies'
import chatRoutes from './routes/chat'

const app = express()
const PORT = Number(process.env.PORT ?? 3001)

const configuredOrigins = (process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      // Non-browser clients such as the VS Code extension do not send Origin.
      if (!origin || configuredOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Origin is not allowed by FLUSEC CORS policy'))
    },
  })
)
app.use(express.json({ limit: '10mb' }))

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'flusec-api', timestamp: new Date().toISOString() })
)
app.get('/api/v1/health', (_req, res) =>
  res.json({ status: 'ok', service: 'flusec-api', timestamp: new Date().toISOString() })
)

// Canonical versioned API.
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/teams', teamsRoutes)
app.use('/api/v1/findings', findingsRoutes)
app.use('/api/v1/members', membersRoutes)
app.use('/api/v1/policies', policiesRoutes)
app.use('/api/v1/chat', chatRoutes)

// Temporary compatibility aliases for an already-deployed frontend/extension.
// New code in this patch uses /api/v1 exclusively.
app.use('/api/auth', authRoutes)
app.use('/api/teams', teamsRoutes)
app.use('/api/findings', findingsRoutes)
app.use('/api/members', membersRoutes)
app.use('/api/policies', policiesRoutes)
app.use('/api/chat', chatRoutes)

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[FLUSEC API]', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`FLUSEC API listening on port ${PORT}`)
})

export default app
