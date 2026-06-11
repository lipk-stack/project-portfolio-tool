import { db } from '../database'
import { emitToUser } from './realtime'
import { sendNotificationEmail } from './mailer'

// Single entry point for user notifications: persists the row, pushes it over
// WebSocket for instant UI updates, and sends an email (no-op without SMTP).
export function createNotification(userId: number, type: string, title: string, message: string | null, link: string | null) {
  const result = db.prepare('INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)')
    .run(userId, type, title, message, link)
  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid)
  emitToUser(userId, 'notification', notification)
  sendNotificationEmail(userId, title, message, link)
  return notification
}
