import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import { initializeDatabase } from './database'

import authRoutes from './routes/auth'
import dashboardRoutes from './routes/dashboard'
import portfoliosRoutes from './routes/portfolios'
import projectsRoutes from './routes/projects'
import tasksRoutes from './routes/tasks'
import resourcesRoutes from './routes/resources'
import risksRoutes from './routes/risks'
import budgetRoutes from './routes/budget'
import reportsRoutes from './routes/reports'
import timelineRoutes from './routes/timeline'
import searchRoutes from './routes/search'
import timesheetsRoutes from './routes/timesheets'
import calendarRoutes from './routes/calendar'
import adminRoutes from './routes/admin'
import templatesRoutes from './routes/templates'
import customFieldsRoutes from './routes/custom-fields'

initializeDatabase()

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
app.use(express.json({ limit: '10mb' }))

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
app.use('/api/timeline', timelineRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/timesheets', timesheetsRoutes)
app.use('/api/calendar', calendarRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/templates', templatesRoutes)
app.use('/api/custom-fields', customFieldsRoutes)

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ProjectPulse server running on http://localhost:${PORT}`)
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
})
