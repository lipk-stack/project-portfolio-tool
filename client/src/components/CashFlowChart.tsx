import { useEffect, useState } from 'react'
import { budgetApi, projectsApi } from '../api'
import Card, { CardHeader } from './ui/Card'
import { Wallet } from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'

interface CashFlowMonth {
  month: string
  planned: number
  actual: number | null
  cumPlanned: number
  cumActual: number | null
}

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

export default function CashFlowChart() {
  const [projects, setProjects] = useState<Array<{ id: number; name: string; status: string }>>([])
  const [projectId, setProjectId] = useState<number | null>(null)
  const [months, setMonths] = useState<CashFlowMonth[]>([])

  useEffect(() => {
    projectsApi.list().then(r => {
      const all = r.data.projects as Array<{ id: number; name: string; status: string }>
      setProjects(all)
      const first = all.find(p => p.status === 'active') || all[0]
      if (first) setProjectId(first.id)
    })
  }, [])

  useEffect(() => {
    if (projectId) budgetApi.cashflow(projectId).then(r => setMonths(r.data.months))
  }, [projectId])

  if (projects.length === 0) return null

  return (
    <Card>
      <CardHeader
        title="Cash Flow (Time-Phased Budget)"
        subtitle="Monthly planned vs actual spend, with cumulative curves"
        icon={Wallet}
        action={
          <select
            value={projectId ?? ''}
            onChange={e => setProjectId(Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        }
      />
      {months.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={months}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtMoney} />
            <Tooltip formatter={(v: number) => fmtMoney(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="planned" name="Planned / mo" fill="#bfdbfe" radius={[3, 3, 0, 0]} />
            <Bar dataKey="actual" name="Actual / mo" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Line type="monotone" dataKey="cumPlanned" name="Cumulative planned" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="cumActual" name="Cumulative actual" stroke="#16a34a" strokeWidth={2.5} dot={false} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-gray-400 py-10 text-center">No schedule data for this project</p>
      )}
    </Card>
  )
}
