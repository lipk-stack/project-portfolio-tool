import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, (req: Request, res: Response) => {
  const { from, to, project_id, user_id } = req.query

  const events: Array<Record<string, unknown>> = []

  // Task deadlines
  let taskQuery = `
    SELECT t.id, t.name as title, t.end_date as date, t.status, t.priority, t.is_critical,
      p.id as project_id, p.name as project_name, p.color, u.name as assignee_name, 'task' as type
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.end_date IS NOT NULL
  `
  const taskParams: (string | number)[] = []
  if (from) { taskQuery += ' AND t.end_date >= ?'; taskParams.push(from as string) }
  if (to) { taskQuery += ' AND t.end_date <= ?'; taskParams.push(to as string) }
  if (project_id) { taskQuery += ' AND t.project_id = ?'; taskParams.push(project_id as string) }
  if (user_id) { taskQuery += ' AND t.assignee_id = ?'; taskParams.push(user_id as string) }
  events.push(...db.prepare(taskQuery).all(...taskParams) as Array<Record<string, unknown>>)

  // Milestones
  let mileQuery = `
    SELECT m.id, m.name as title, m.date, m.status,
      p.id as project_id, p.name as project_name, p.color, 'milestone' as type
    FROM milestones m JOIN projects p ON p.id = m.project_id WHERE 1=1
  `
  const mileParams: (string | number)[] = []
  if (from) { mileQuery += ' AND m.date >= ?'; mileParams.push(from as string) }
  if (to) { mileQuery += ' AND m.date <= ?'; mileParams.push(to as string) }
  if (project_id) { mileQuery += ' AND m.project_id = ?'; mileParams.push(project_id as string) }
  events.push(...db.prepare(mileQuery).all(...mileParams) as Array<Record<string, unknown>>)

  // Project end dates as project deadline events
  let projQuery = `
    SELECT p.id, p.name as title, p.end_date as date, p.status, p.health, p.color,
      p.id as project_id, p.name as project_name, 'project-end' as type
    FROM projects p WHERE p.end_date IS NOT NULL AND p.status NOT IN ('cancelled')
  `
  const projParams: (string | number)[] = []
  if (from) { projQuery += ' AND p.end_date >= ?'; projParams.push(from as string) }
  if (to) { projQuery += ' AND p.end_date <= ?'; projParams.push(to as string) }
  if (project_id) { projQuery += ' AND p.id = ?'; projParams.push(project_id as string) }
  events.push(...db.prepare(projQuery).all(...projParams) as Array<Record<string, unknown>>)

  events.sort((a, b) => String(a.date).localeCompare(String(b.date)))
  res.json({ events })
})

export default router
