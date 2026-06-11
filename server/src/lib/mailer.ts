import nodemailer, { Transporter } from 'nodemailer'
import { db } from '../database'

// Email delivery is optional: without SMTP_HOST configured every send is a
// silent no-op, so the app works out of the box and email is purely additive.
let transporter: Transporter | null = null
let initialized = false

function getTransporter(): Transporter | null {
  if (!initialized) {
    initialized = true
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      })
    }
  }
  return transporter
}

export function isMailerConfigured(): boolean {
  return !!getTransporter()
}

// Fire-and-forget: a mail failure must never break the API call that caused it.
export function sendNotificationEmail(userId: number, title: string, message: string | null, link: string | null) {
  const t = getTransporter()
  if (!t) return

  const user = db.prepare('SELECT email, name, email_notifications FROM users WHERE id = ?').get(userId) as
    { email: string; name: string; email_notifications: number } | undefined
  if (!user || !user.email_notifications) return

  const appUrl = (process.env.APP_URL || 'http://localhost:3001').replace(/\/$/, '')
  const url = link ? `${appUrl}${link}` : appUrl

  t.sendMail({
    from: process.env.SMTP_FROM || 'ProjectPulse <noreply@projectpulse.local>',
    to: user.email,
    subject: `[ProjectPulse] ${title}`,
    text: `Hi ${user.name},\n\n${title}\n${message ? `\n${message}\n` : ''}\nView it here: ${url}\n\n— ProjectPulse`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#2563eb;color:#fff;padding:14px 20px;border-radius:8px 8px 0 0;font-weight:bold">ProjectPulse</div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px">
          <p style="margin:0 0 8px">Hi ${user.name},</p>
          <p style="margin:0 0 8px;font-weight:bold">${title}</p>
          ${message ? `<p style="margin:0 0 16px;color:#4b5563">${message}</p>` : ''}
          <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none">Open in ProjectPulse</a>
        </div>
      </div>`,
  }).catch(err => console.error('Email send failed:', err.message))
}
