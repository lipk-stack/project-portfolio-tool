import PDFDocument from 'pdfkit'
import { db } from '../database'
import { scoreProjectById } from './healthService'

interface ProjectRow {
  id: number
  name: string
  status: string
  health: string
  start_date: string | null
  end_date: string | null
  completion_percent: number
  budget: number
  spent: number
  manager_name: string | null
}

const HEALTH_COLORS: Record<string, string> = { green: '#16A34A', yellow: '#CA8A04', red: '#DC2626' }

function money(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

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

// Multi-project executive briefing: portfolio KPIs, project scorecard table,
// top risks, and the 30-day milestone outlook. portfolioId null = all projects.
export function buildPortfolioPdf(portfolioId: number | null): PDFKit.PDFDocument | null {
  let portfolioName = 'All Portfolios'
  if (portfolioId != null) {
    const portfolio = db.prepare('SELECT name FROM portfolios WHERE id = ?').get(portfolioId) as { name: string } | undefined
    if (!portfolio) return null
    portfolioName = portfolio.name
  }

  const projects = db.prepare(`
    SELECT p.id, p.name, p.status, p.health, p.start_date, p.end_date,
      p.completion_percent, p.budget, p.spent, u.name as manager_name
    FROM projects p LEFT JOIN users u ON u.id = p.manager_id
    ${portfolioId != null ? 'WHERE p.portfolio_id = ?' : ''}
    ORDER BY p.status = 'active' DESC, p.priority = 'critical' DESC, p.budget DESC
  `).all(...(portfolioId != null ? [portfolioId] : [])) as ProjectRow[]

  const risks = db.prepare(`
    SELECT r.title, r.score, r.status, p.name as project_name
    FROM risks r JOIN projects p ON p.id = r.project_id
    WHERE r.status != 'closed' ${portfolioId != null ? 'AND p.portfolio_id = ?' : ''}
    ORDER BY r.score DESC LIMIT 8
  `).all(...(portfolioId != null ? [portfolioId] : [])) as Array<{ title: string; score: number; status: string; project_name: string }>

  const milestones = db.prepare(`
    SELECT m.name, m.date, m.status, p.name as project_name
    FROM milestones m JOIN projects p ON p.id = m.project_id
    WHERE m.status != 'achieved' AND m.date <= date('now', '+30 days')
      ${portfolioId != null ? 'AND p.portfolio_id = ?' : ''}
    ORDER BY m.date ASC LIMIT 8
  `).all(...(portfolioId != null ? [portfolioId] : [])) as Array<{ name: string; date: string; status: string; project_name: string }>

  const active = projects.filter(p => p.status === 'active')
  const totals = projects.reduce((acc, p) => {
    const evm = computeEvm(p)
    acc.bac += evm.bac; acc.ac += evm.ac; acc.ev += evm.ev; acc.pv += evm.pv
    return acc
  }, { bac: 0, ac: 0, ev: 0, pv: 0 })
  const portfolioCpi = totals.ac > 0 ? totals.ev / totals.ac : null
  const portfolioSpi = totals.pv > 0 ? totals.ev / totals.pv : null
  const avgCompletion = active.length ? Math.round(active.reduce((s, p) => s + p.completion_percent, 0) / active.length) : 0

  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `${portfolioName} — Portfolio Briefing` } })
  const pageWidth = doc.page.width - 96

  // Header band
  doc.rect(0, 0, doc.page.width, 92).fill('#1E3A8A')
  doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(20).text(portfolioName, 48, 26, { width: pageWidth - 140 })
  doc.font('Helvetica').fontSize(10).fill('#BFDBFE').text('Portfolio Executive Briefing', 48, doc.y + 2)
  doc.fontSize(9).text(`Generated ${new Date().toISOString().slice(0, 10)} · Helmsman`, doc.page.width - 220, 32, { width: 172, align: 'right' })

  let y = 112

  // KPI boxes
  const kpis = [
    { label: 'Projects', value: `${projects.length}` },
    { label: 'Active', value: `${active.length}` },
    { label: 'Total Budget', value: money(totals.bac) },
    { label: 'Spent', value: money(totals.ac) },
    { label: 'Avg Complete', value: `${avgCompletion}%` },
    { label: 'CPI / SPI', value: `${portfolioCpi != null ? portfolioCpi.toFixed(2) : '-'} / ${portfolioSpi != null ? portfolioSpi.toFixed(2) : '-'}`, alert: (portfolioCpi != null && portfolioCpi < 1) || (portfolioSpi != null && portfolioSpi < 1) },
  ]
  const boxW = (pageWidth - 5 * 8) / 6
  kpis.forEach((kpi, i) => {
    const x = 48 + i * (boxW + 8)
    doc.roundedRect(x, y, boxW, 48, 4).fill('#F3F4F6')
    doc.fill('#6B7280').font('Helvetica').fontSize(7).text(kpi.label.toUpperCase(), x + 6, y + 8, { width: boxW - 12 })
    doc.fill(kpi.alert ? '#DC2626' : '#111827').font('Helvetica-Bold').fontSize(13).text(kpi.value, x + 6, y + 22, { width: boxW - 12 })
  })
  y += 68

  // Auto-generated portfolio health band (computed health score across the
  // in-scope projects, reusing the same scoring engine as the app/insights API).
  const scored = projects.map((p) => scoreProjectById(p.id)).filter((s): s is NonNullable<typeof s> => s != null)
  if (scored.length) {
    const RAG_BAND: Record<string, { color: string; word: string }> = {
      green: { color: '#16A34A', word: 'GREEN' },
      amber: { color: '#CA8A04', word: 'AMBER' },
      red: { color: '#DC2626', word: 'RED' },
    }
    const avg = Math.round(scored.reduce((s, x) => s + x.score, 0) / scored.length)
    const rag = avg >= 80 ? 'green' : avg >= 55 ? 'amber' : 'red'
    const counts = { green: 0, amber: 0, red: 0 }
    for (const s of scored) counts[s.rag]++
    const band = RAG_BAND[rag]
    const worst = [...scored].sort((a, b) => a.score - b.score)[0]

    doc.roundedRect(48, y, pageWidth, 50, 4).fill('#F9FAFB')
    doc.rect(48, y, 4, 50).fill(band.color)
    doc.fill('#374151').font('Helvetica-Bold').fontSize(10).text('Portfolio Health (Auto-Generated)', 60, y + 8)
    doc.fill(band.color).font('Helvetica-Bold').fontSize(12).text(`${band.word} · ${avg}/100`, doc.page.width - 220, y + 8, { width: 172, align: 'right' })
    doc.fill('#6B7280').font('Helvetica').fontSize(9).text(
      `${counts.green} green · ${counts.amber} amber · ${counts.red} red across ${scored.length} project${scored.length === 1 ? '' : 's'}. Lowest: ${worst.name} (${worst.score}) — ${worst.headline}`,
      60, y + 26, { width: pageWidth - 24, height: 18, ellipsis: true }
    )
    y += 64
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > doc.page.height - 70) {
      doc.addPage()
      y = 48
    }
  }

  // Project scorecard table
  doc.fill('#374151').font('Helvetica-Bold').fontSize(11).text('Project Scorecard', 48, y)
  y = doc.y + 6
  const cols = [pageWidth * 0.3, pageWidth * 0.12, pageWidth * 0.1, pageWidth * 0.12, pageWidth * 0.12, pageWidth * 0.12, pageWidth * 0.12]
  const headers = ['Project', 'Health', 'Done', 'Budget', 'Spent', 'CPI', 'SPI']
  doc.rect(48, y, pageWidth, 16).fill('#F3F4F6')
  let hx = 48
  headers.forEach((h, i) => {
    doc.fill('#6B7280').font('Helvetica-Bold').fontSize(8).text(h.toUpperCase(), hx + 6, y + 4, { width: cols[i] - 12 })
    hx += cols[i]
  })
  y += 16
  projects.slice(0, 25).forEach((p, ri) => {
    ensureSpace(20)
    if (ri % 2 === 1) doc.rect(48, y, pageWidth, 16).fill('#FAFAFA')
    const evm = computeEvm(p)
    const cells = [
      p.name,
      p.health,
      `${p.completion_percent}%`,
      money(evm.bac),
      money(evm.ac),
      evm.cpi != null ? evm.cpi.toFixed(2) : '-',
      evm.spi != null ? evm.spi.toFixed(2) : '-',
    ]
    let cx = 48
    cells.forEach((cell, ci) => {
      let color = '#374151'
      if (ci === 1) color = HEALTH_COLORS[p.health] || '#374151'
      if (ci === 5 && evm.cpi != null && evm.cpi < 1) color = '#DC2626'
      if (ci === 6 && evm.spi != null && evm.spi < 1) color = '#DC2626'
      doc.fill(color).font(ci === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
        .text(cell, cx + 6, y + 4, { width: cols[ci] - 12, height: 12, ellipsis: true })
      cx += cols[ci]
    })
    y += 16
  })
  y += 14

  const sectionTable = (title: string, headers2: string[], widths: number[], rows: string[][], rowColors?: (string | null)[]) => {
    ensureSpace(60)
    doc.fill('#374151').font('Helvetica-Bold').fontSize(11).text(title, 48, y)
    y = doc.y + 6
    doc.rect(48, y, pageWidth, 16).fill('#F3F4F6')
    let x = 48
    headers2.forEach((h, i) => {
      doc.fill('#6B7280').font('Helvetica-Bold').fontSize(8).text(h.toUpperCase(), x + 6, y + 4, { width: widths[i] - 12 })
      x += widths[i]
    })
    y += 16
    if (rows.length === 0) {
      doc.fill('#9CA3AF').font('Helvetica').fontSize(9).text('None', 54, y + 4)
      y += 20
    }
    rows.forEach((row, ri) => {
      ensureSpace(20)
      if (ri % 2 === 1) doc.rect(48, y, pageWidth, 16).fill('#FAFAFA')
      let cx = 48
      row.forEach((cell, ci) => {
        const color = rowColors?.[ri] && ci === row.length - 1 ? rowColors[ri]! : '#374151'
        doc.fill(color).font('Helvetica').fontSize(9).text(cell, cx + 6, y + 4, { width: widths[ci] - 12, height: 12, ellipsis: true })
        cx += widths[ci]
      })
      y += 16
    })
    y += 14
  }

  sectionTable(
    'Top Open Risks',
    ['Risk', 'Project', 'Status', 'Score'],
    [pageWidth * 0.45, pageWidth * 0.27, pageWidth * 0.16, pageWidth * 0.12],
    risks.map(r => [r.title, r.project_name, r.status, String(r.score)]),
    risks.map(r => (r.score >= 6 ? '#DC2626' : null))
  )

  sectionTable(
    'Milestones — Next 30 Days',
    ['Milestone', 'Project', 'Date'],
    [pageWidth * 0.45, pageWidth * 0.3, pageWidth * 0.25],
    milestones.map(m => [m.name, m.project_name, m.date]),
    milestones.map(m => (m.date < new Date().toISOString().slice(0, 10) ? '#DC2626' : null))
  )

  doc.fill('#9CA3AF').font('Helvetica').fontSize(8)
    .text('Generated by Helmsman — Enterprise Portfolio Management', 48, doc.page.height - 60, { width: pageWidth, align: 'center' })

  doc.end()
  return doc
}
