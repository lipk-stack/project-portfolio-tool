import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import http from 'http'
import { initializeDatabase } from './database'
import { initRealtime } from './lib/realtime'
import { runDailyChecks } from './lib/dailyChecksService'
import { startDailyScheduler, logDailyResult } from './lib/scheduler'

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

// Daily-sweep bootstrap: records today's health snapshot (seeding a synthetic
// trend on a fresh DB) and raises the day-over-day alerts — health red/recovery
// transitions plus newly overdue tasks and budget overruns. All alerts are
// suppressed on the very first bootstrap so the synthetic backfill and seeded
// demo data can't manufacture a flood. See lib/dailyChecksService.ts.
//
// startDailyScheduler() then keeps the sweep firing for a long-running server:
// it re-arms at each UTC midnight so overdue/overrun/health alerts surface
// without needing a restart. The sweep is idempotent per day, so the bootstrap
// run and the first scheduled run never double-alert. See lib/scheduler.ts.
try {
  logDailyResult(runDailyChecks())
  startDailyScheduler()
} catch (err) {
  console.error('Daily checks bootstrap failed:', err)
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
