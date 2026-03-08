import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth'
import teamsRoutes from './routes/teams'
import findingsRoutes from './routes/findings'
import membersRoutes from './routes/members'
import notificationsRoutes from './routes/notifications'

const app = express()
const PORT = process.env.PORT ?? 3001

// ─── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '10mb' }))

// ─── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/teams', teamsRoutes)
app.use('/api/findings', findingsRoutes)
app.use('/api/members', membersRoutes)
app.use('/api/notifications', notificationsRoutes)

// ─── Global error handler ─────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Error]', err.message)
    res.status(500).json({ error: err.message ?? 'Internal server error' })
})

app.listen(PORT, () => {
    console.log(`✅ FluSec API running on http://localhost:${PORT}`)
})

export default app
