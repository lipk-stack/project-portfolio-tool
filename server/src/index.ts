import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import http from 'http'
import { initializeDatabase, db } from './database'
import { initRealtime } from './lib/realtime'
import { recordDailySnapshots, backfillDemoHistory, notifyRedTransitions, notifyHealthRecoveries } from './lib/healthService'

import authRoutes from './routes/auth'
import dashboardRoutes from './routes/dashboard'
import portfoliosRoutes from './routes/portfolios'
import projectsRoutes from './routes/projects'
import tasksRoutes from './routes/tasks'
import resourcesRoutes from './routes/resources'
import risksRoutes from './routes/risks'
import budgetRoutes from './routes/budget'
import reportsRoutes from './routes/reports'
import evmRoutes from './routes/evm'
import exportsRoutes from './routes/exports'
import searchRoutes from './routes/search'
import commentsRoutes from './routes/comments'
import notificationsRoutes from './routes/notifications'
import calendarRoutes from './routes/calendar'
import sprintsRoutes from './routes/sprints'
import automationsRoutes from './routes/automations'
import viewsRoutes from './routes/views'
import customFieldsRoutes from './routes/customFields'
import scenarioRoutes from './routes/scenario'
import tokensRoutes from './routes/tokens'
import webhooksRoutes from './routes/webhooks'
import activityRoutes from './routes/activity'
import attachmentsRoutes from './routes/attachments'
import insightsRoutes from './routes/insights'

initializeDatabase()

// Health-score history bootstrap: seed a one-time synthetic trend on a fresh
// database so the sparklines aren't blank, then record today's real snapshot.
// recordDailySnapshots is idempotent per (project, date), so restarting the
// server simply refreshes today's point as the underlying data changes.
try {
  const hist = db.prepare('SELECT COUNT(*) as c FROM health_history').get() as { c: number }
  const proj = db.prepare("SELECT COUNT(*) as c FROM projects WHERE status NOT IN ('cancelled')").get() as { c: number }
  const freshHistory = hist.c === 0 && proj.c > 0
  if (freshHistory) backfillDemoHistory()
  recordDailySnapshots()
  // Only raise red-transition alerts on real day-over-day data — never on the
  // very first bootstrap (the synthetic backfill would spam manufactured drops).
  if (!freshHistory) {
    const alerted = notifyRedTransitions()
    if (alerted.length) console.log(`⚠️  Health alerts raised for: ${alerted.join(', ')}`)
    const recovered = notifyHealthRecoveries()
    if (recovered.length) console.log(`✅ Health recoveries noted for: ${recovered.join(', ')}`)
  }
} catch (err) {
  console.error('Health snapshot bootstrap failed:', err)
}

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)
const isProduction = process.env.NODE_ENV === 'production'

app.use(cors({
  origin: isProduction ? false : (process.env.CORS_ORIGIN || 'http://localhost:5173'),
  credentials: true,
}))

app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false,
  crossOriginEmbedderPolicy: false,
}))
// 20mb accommodates base64-encoded file uploads up to the 10MB decoded cap.
app.use(express.json({ limit: '20mb' }))

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.use('/api/auth', authRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/portfolios', portfoliosRoutes)
app.use('/api/projects', projectsRoutes)
app.use('/api/tasks', tasksRoutes)
app.use('/api/resources', resourcesRoutes)
app.use('/api/risks', risksRoutes)
app.use('/api/budget', budgetRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/evm', evmRoutes)
app.use('/api/export', exportsRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/comments', commentsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/calendar', calendarRoutes)
app.use('/api/sprints', sprintsRoutes)
app.use('/api/automations', automationsRoutes)
app.use('/api/views', viewsRoutes)
app.use('/api/custom-fields', customFieldsRoutes)
app.use('/api/scenario', scenarioRoutes)
app.use('/api/tokens', tokensRoutes)
app.use('/api/webhooks', webhooksRoutes)
app.use('/api/activity', activityRoutes)
app.use('/api/attachments', attachmentsRoutes)
app.use('/api/insights', insightsRoutes)

if (isProduction) {
  const publicDir = path.join(__dirname, '../public')
  app.use(express.static(publicDir))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'))
  })
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

const httpServer = http.createServer(app)
initRealtime(httpServer)

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Portia server running on http://localhost:${PORT}`)
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
})
