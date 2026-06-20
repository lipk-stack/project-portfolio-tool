import PDFDocument from 'pdfkit'
import { db } from '../database'
import { scoreProjectById } from './healthService'

const RAG_COLORS: Record<string, string> = { green: '#16A34A', amber: '#CA8A04', red: '#DC2626' }

interface ProjectRow {
  id: number
  name: string
  description: string | null
  status: string
  priority: string
  health: string
  phase: string | null
  start_date: string | null
  end_date: string | null
  completion_percent: number
  budget: number
  spent: number
  manager_name: string | null
}

const HEALTH_COLORS: Record<string, string> = { green: '#16A34A', yellow: '#CA8A04', red: '#DC2626' }
const HEALTH_LABELS: Record<string, string> = { green: 'On Track', yellow: 'At Risk', red: 'Off Track' }

function money(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

// Simple PMBOK EVM with linear PV interpolation (matches the EVM route's approach)
function computeEvm(p: ProjectRow) {
  const bac = p.budget || 0
  const ev = bac * (p.completion_percent / 100)
  const ac = p.spent || 0
  let pv = 0
  if (p.start_date && p.end_date && bac > 0) {
    const start = new Date(p.start_date).getTime()
    const end = new Date(p.end_date).getTime()
    const now = Date.now()
    const frac = end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : 0
    pv = bac * frac
  }
  const cpi = ac > 0 ? ev / ac : null
  const spi = pv > 0 ? ev / pv : null
  return { bac, ev, ac, pv, cpi, spi }
}

export function buildStatusPdf(projectId: number): PDFKit.PDFDocument | null {
  const project = db.prepare(`
    SELECT p.*, u.name as manager_name FROM projects p
    LEFT JOIN users u ON u.id = p.manager_id WHERE p.id = ?
  `).get(projectId) as ProjectRow | undefined
  if (!project) return null

  const taskStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status != 'done' AND end_date < date('now') THEN 1 ELSE 0 END) as overdue
    FROM tasks WHERE project_id = ?
  `).get(projectId) as { total: number; done: number; in_progress: number; overdue: number }

  const milestones = db.prepare(`
    SELECT name, date, status FROM milestones WHERE project_id = ? ORDER BY date ASC LIMIT 8
  `).all(projectId) as Array<{ name: string; date: string; status: string }>

  const risks = db.prepare(`
    SELECT r.title, r.probability, r.impact, r.score, r.status, u.name as owner_name
    FROM risks r LEFT JOIN users u ON u.id = r.owner_id
    WHERE r.project_id = ? AND r.status != 'closed'
    ORDER BY r.score DESC LIMIT 5
  `).all(projectId) as Array<{ title: string; probability: string; impact: string; score: number; status: string; owner_name: string | null }>

  const evm = computeEvm(project)

  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `${project.name} — Status Report` } })
  const pageWidth = doc.page.width - 96

  // Header band
  doc.rect(0, 0, doc.page.width, 92).fill('#1E3A8A')
  doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(20).text(project.name, 48, 26, { width: pageWidth - 140 })
  doc.font('Helvetica').fontSize(10).fill('#BFDBFE')
    .text('Executive Status Report', 48, doc.y + 2)
  doc.fontSize(9).text(`Generated ${new Date().toISOString().slice(0, 10)} · Portia`, doc.page.width - 220, 32, { width: 172, align: 'right' })

  const healthColor = HEALTH_COLORS[project.health] || '#6B7280'
  doc.roundedRect(doc.page.width - 152, 50, 104, 22, 4).fill(healthColor)
  doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(10)
    .text(HEALTH_LABELS[project.health] || project.health, doc.page.width - 152, 56, { width: 104, align: 'center' })

  let y = 112

  // Summary line
  doc.fill('#374151').font('Helvetica').fontSize(10)
  const summary = [
    `Manager: ${project.manager_name || '—'}`,
    `Status: ${project.status.replace('_', ' ')}`,
    `Priority: ${project.priority}`,
    project.phase ? `Phase: ${project.phase}` : null,
    `Schedule: ${project.start_date || 'n/a'} - ${project.end_date || 'n/a'}`,
  ].filter(Boolean).join('   ·   ')
  doc.text(summary, 48, y, { width: pageWidth })
  y = doc.y + 6

  if (project.description) {
    doc.fill('#6B7280').fontSize(9).text(project.description, 48, y, { width: pageWidth, height: 30, ellipsis: true })
    y = doc.y + 10
  }

  // KPI boxes
  const kpis = [
    { label: 'Completion', value: `${project.completion_percent}%` },
    { label: 'Budget (BAC)', value: money(evm.bac) },
    { label: 'Spent (AC)', value: money(evm.ac) },
    { label: 'Earned Value', value: money(evm.ev) },
    { label: 'CPI', value: evm.cpi != null ? evm.cpi.toFixed(2) : '—', alert: evm.cpi != null && evm.cpi < 1 },
    { label: 'SPI', value: evm.spi != null ? evm.spi.toFixed(2) : '—', alert: evm.spi != null && evm.spi < 1 },
  ]
  const boxW = (pageWidth - 5 * 8) / 6
  kpis.forEach((kpi, i) => {
    const x = 48 + i * (boxW + 8)
    doc.roundedRect(x, y, boxW, 48, 4).fill('#F3F4F6')
    doc.fill('#6B7280').font('Helvetica').fontSize(7).text(kpi.label.toUpperCase(), x + 6, y + 8, { width: boxW - 12 })
    doc.fill(kpi.alert ? '#DC2626' : '#111827').font('Helvetica-Bold').fontSize(14)
      .text(kpi.value, x + 6, y + 22, { width: boxW - 12 })
  })
  y += 64

  // Progress bar
  doc.fill('#374151').font('Helvetica-Bold').fontSize(11).text('Overall Progress', 48, y)
  y = doc.y + 6
  doc.roundedRect(48, y, pageWidth, 10, 5).fill('#E5E7EB')
  if (project.completion_percent > 0) {
    doc.roundedRect(48, y, Math.max(10, pageWidth * project.completion_percent / 100), 10, 5).fill(healthColor)
  }
  y += 24

  // Task stats line
  doc.fill('#6B7280').font('Helvetica').fontSize(9).text(
    `Tasks: ${taskStats.total} total · ${taskStats.done || 0} done · ${taskStats.in_progress || 0} in progress · ${taskStats.overdue || 0} overdue`,
    48, y
  )
  y = doc.y + 16

  // Health Insights — the same composite score + auto-narrative shown in-app,
  // so the exported report carries the engine's verdict and recommendation.
  const health = scoreProjectById(project.id)
  if (health) {
    const ragColor = RAG_COLORS[health.rag] || '#6B7280'
    doc.fill('#374151').font('Helvetica-Bold').fontSize(11).text('Health Insights (Auto-Generated)', 48, y)
    y = doc.y + 6
    doc.roundedRect(48, y, 132, 20, 4).fill(ragColor)
    doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(9)
      .text(`${health.rag.toUpperCase()} · Health ${health.score}/100`, 48, y + 6, { width: 132, align: 'center' })
    doc.fill('#374151').font('Helvetica').fontSize(9)
      .text(health.summary, 192, y, { width: pageWidth - 144 })
    y = Math.max(y + 28, doc.y + 12)
  }

  const sectionTable = (
    title: string,
    headers: string[],
    widths: number[],
    rows: string[][],
    rowColors?: (string | null)[]
  ) => {
    doc.fill('#374151').font('Helvetica-Bold').fontSize(11).text(title, 48, y)
    y = doc.y + 6
    doc.rect(48, y, pageWidth, 16).fill('#F3F4F6')
    let x = 48
    headers.forEach((h, i) => {
      doc.fill('#6B7280').font('Helvetica-Bold').fontSize(8).text(h.toUpperCase(), x + 6, y + 4, { width: widths[i] - 12 })
      x += widths[i]
    })
    y += 16
    if (rows.length === 0) {
      doc.fill('#9CA3AF').font('Helvetica').fontSize(9).text('None', 54, y + 4)
      y += 20
    }
    rows.forEach((row, ri) => {
      if (ri % 2 === 1) doc.rect(48, y, pageWidth, 16).fill('#FAFAFA')
      let cx = 48
      row.forEach((cell, ci) => {
        const color = ci === row.length - 1 && rowColors?.[ri] ? rowColors[ri]! : '#374151'
        doc.fill(color).font('Helvetica').fontSize(9).text(cell, cx + 6, y + 4, { width: widths[ci] - 12, height: 12, ellipsis: true })
        cx += widths[ci]
      })
      y += 16
    })
    y += 14
  }

  sectionTable(
    'Milestones',
    ['Milestone', 'Date', 'Status'],
    [pageWidth * 0.55, pageWidth * 0.2, pageWidth * 0.25],
    milestones.map(m => [m.name, m.date, m.status.replace('_', ' ')]),
    milestones.map(m => m.status === 'completed' ? '#16A34A' : (m.status === 'missed' || (m.status !== 'completed' && m.date < new Date().toISOString().slice(0, 10)) ? '#DC2626' : null))
  )

  sectionTable(
    'Top Open Risks',
    ['Risk', 'Probability', 'Impact', 'Score', 'Owner'],
    [pageWidth * 0.4, pageWidth * 0.14, pageWidth * 0.14, pageWidth * 0.1, pageWidth * 0.22],
    risks.map(r => [r.title, r.probability, r.impact, String(r.score), r.owner_name || '—']),
  )

  // Footer
  doc.fill('#9CA3AF').font('Helvetica').fontSize(8)
    .text('Generated by Portia — Enterprise Portfolio Management', 48, doc.page.height - 60, { width: pageWidth, align: 'center' })

  doc.end()
  return doc
}
