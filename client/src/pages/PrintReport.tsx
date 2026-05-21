import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { projectsApi, reportsApi } from '../api'
import { format, parseISO } from 'date-fns'

export default function PrintReport() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<any>(null)
  const [evm, setEvm] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [risks, setRisks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const numId = parseInt(id)
    Promise.all([
      projectsApi.get(numId),
      reportsApi.evm(numId),
    ]).then(([pr, er]) => {
      setProject(pr.data.project)
      setTasks(pr.data.tasks || [])
      setRisks(pr.data.risks || [])
      setEvm(er.data)
    }).finally(() => {
      setLoading(false)
      setTimeout(() => window.print(), 500)
    })
  }, [id])

  if (loading) return <div style={{ fontFamily: 'sans-serif', padding: 40 }}>Loading report…</div>
  if (!project) return <div>Project not found</div>

  const doneTasks = tasks.filter(t => t.status === 'done').length
  const openRisks = risks.filter(r => r.status !== 'closed')
  const highRisks = openRisks.filter(r => r.score >= 6)

  return (
    <div className="print-report" style={{ fontFamily: 'Arial, sans-serif', padding: '40px', maxWidth: 900, margin: '0 auto', color: '#1a1a1a' }}>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          .page-break { page-break-after: always; }
        }
        @media screen {
          .print-report { box-shadow: 0 0 20px rgba(0,0,0,0.1); }
        }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
        td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
        tr:last-child td { border-bottom: none; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .kpi { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
        .kpi-value { font-size: 24px; font-weight: 700; color: #111827; }
        .kpi-label { font-size: 12px; color: #6b7280; margin-top: 2px; }
        h1 { font-size: 28px; margin: 0 0 4px; }
        h2 { font-size: 16px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin: 28px 0 12px; }
        h3 { font-size: 13px; color: #6b7280; margin: 0; font-weight: normal; }
        .progress-bar { background: #e5e7eb; border-radius: 4px; height: 8px; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 4px; }
      `}</style>

      {/* Print button - hidden when printing */}
      <div className="no-print" style={{ marginBottom: 24, display: 'flex', gap: 12 }}>
        <button onClick={() => window.print()} style={{ padding: '8px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          🖨️ Print / Save as PDF
        </button>
        <button onClick={() => window.close()} style={{ padding: '8px 20px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}>
          Close
        </button>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, paddingBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: project.color }} />
            <h1>{project.name}</h1>
          </div>
          <h3>{project.description || 'No description'}</h3>
          <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 12, color: '#6b7280' }}>
            <span>Manager: <strong>{project.manager_name || '—'}</strong></span>
            {project.start_date && <span>Start: <strong>{format(parseISO(project.start_date), 'MMM d, yyyy')}</strong></span>}
            {project.end_date && <span>End: <strong>{format(parseISO(project.end_date), 'MMM d, yyyy')}</strong></span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: '#9ca3af' }}>
          <div>Report generated</div>
          <div>{format(new Date(), 'MMMM d, yyyy')}</div>
        </div>
      </div>

      {/* Status badges */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <span className="badge" style={{ background: project.status === 'active' ? '#dcfce7' : '#f3f4f6', color: project.status === 'active' ? '#166534' : '#374151' }}>{project.status}</span>
        <span className="badge" style={{ background: project.health === 'green' ? '#dcfce7' : project.health === 'yellow' ? '#fef9c3' : '#fee2e2', color: project.health === 'green' ? '#166534' : project.health === 'yellow' ? '#854d0e' : '#991b1b' }}>
          {project.health === 'green' ? '● On Track' : project.health === 'yellow' ? '● At Risk' : '● Off Track'}
        </span>
        <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>{project.priority} priority</span>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-value">{project.completion_percent}%</div>
          <div className="kpi-label">Complete</div>
        </div>
        <div className="kpi">
          <div className="kpi-value">{doneTasks}/{tasks.length}</div>
          <div className="kpi-label">Tasks Done</div>
        </div>
        <div className="kpi">
          <div className="kpi-value">${(project.spent / 1000).toFixed(0)}K</div>
          <div className="kpi-label">Spent of ${(project.budget / 1000).toFixed(0)}K</div>
        </div>
        <div className="kpi">
          <div className="kpi-value">{openRisks.length}</div>
          <div className="kpi-label">Open Risks ({highRisks.length} High)</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 8, fontSize: 13, color: '#374151', fontWeight: 600 }}>Completion Progress</div>
      <div className="progress-bar" style={{ marginBottom: 24 }}>
        <div className="progress-fill" style={{ width: `${project.completion_percent}%`, background: project.health === 'green' ? '#22c55e' : project.health === 'yellow' ? '#eab308' : '#ef4444' }} />
      </div>

      {/* EVM Section */}
      {evm && project.budget > 0 && (
        <>
          <h2>Earned Value Analysis</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Planned Value (PV)', value: `$${(evm.pv / 1000).toFixed(1)}K` },
              { label: 'Earned Value (EV)', value: `$${(evm.ev / 1000).toFixed(1)}K` },
              { label: 'Actual Cost (AC)', value: `$${(evm.ac / 1000).toFixed(1)}K` },
              { label: 'CPI', value: evm.cpi?.toFixed(2), note: evm.cpi >= 1 ? 'Under budget ✓' : 'Over budget ⚠' },
              { label: 'SPI', value: evm.spi?.toFixed(2), note: evm.spi >= 1 ? 'On schedule ✓' : 'Behind schedule ⚠' },
              { label: 'EAC (Forecast)', value: `$${(evm.eac / 1000).toFixed(1)}K` },
            ].map((m, i) => (
              <div key={i} className="kpi" style={{ padding: 12 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{m.value}</div>
                {m.note && <div style={{ fontSize: 11, color: '#6b7280' }}>{m.note}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Tasks table */}
      <h2>Task Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Assignee</th>
            <th>Due Date</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {tasks.filter(t => !t.parent_id).slice(0, 20).map((t: any) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>
                <span className="badge" style={{
                  background: t.status === 'done' ? '#dcfce7' : t.status === 'in_progress' ? '#dbeafe' : t.status === 'blocked' ? '#fee2e2' : '#f3f4f6',
                  color: t.status === 'done' ? '#166534' : t.status === 'in_progress' ? '#1d4ed8' : t.status === 'blocked' ? '#991b1b' : '#374151'
                }}>{t.status.replace('_', ' ')}</span>
              </td>
              <td>{t.priority}</td>
              <td>{t.assignee_name || '—'}</td>
              <td>{t.end_date ? format(parseISO(t.end_date), 'MMM d') : '—'}</td>
              <td>{t.completion_percent}%</td>
            </tr>
          ))}
          {tasks.length > 20 && <tr><td colSpan={6} style={{ color: '#9ca3af', fontStyle: 'italic' }}>… and {tasks.length - 20} more tasks</td></tr>}
        </tbody>
      </table>

      {/* Risks table */}
      {risks.length > 0 && (
        <>
          <h2>Risk Register</h2>
          <table>
            <thead>
              <tr>
                <th>Risk</th>
                <th>Category</th>
                <th>Probability</th>
                <th>Impact</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td style={{ textTransform: 'capitalize' }}>{r.category || '—'}</td>
                  <td>{r.probability}/5</td>
                  <td>{r.impact}/5</td>
                  <td>
                    <span className="badge" style={{
                      background: r.score >= 15 ? '#fee2e2' : r.score >= 8 ? '#fef9c3' : '#dcfce7',
                      color: r.score >= 15 ? '#991b1b' : r.score >= 8 ? '#854d0e' : '#166534'
                    }}>{r.score}</span>
                  </td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #e5e7eb', fontSize: 11, color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
        <span>ProjectPulse Portfolio Management</span>
        <span>Confidential — {format(new Date(), 'yyyy')}</span>
      </div>
    </div>
  )
}
