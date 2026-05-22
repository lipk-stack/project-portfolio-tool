import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface VelocityChartProps {
  projectId: number
}

export default function VelocityChart({ projectId }: VelocityChartProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/tasks?project_id=${projectId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(res => {
        const tasks = res.tasks || []
        // Group completed tasks by week
        const weekMap: Record<string, { completed: number; added: number }> = {}
        tasks.filter((t: any) => t.status === 'done' && t.story_points).forEach((t: any) => {
          const d = new Date(t.updated_at || t.end_date || Date.now())
          const week = `W${getWeekNumber(d)}`
          if (!weekMap[week]) weekMap[week] = { completed: 0, added: 0 }
          weekMap[week].completed += t.story_points || 0
        })
        tasks.filter((t: any) => t.story_points).forEach((t: any) => {
          const d = new Date(t.created_at || Date.now())
          const week = `W${getWeekNumber(d)}`
          if (!weekMap[week]) weekMap[week] = { completed: 0, added: 0 }
          weekMap[week].added += t.story_points || 0
        })
        const sorted = Object.entries(weekMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-8)
          .map(([week, vals]) => ({ week, ...vals }))
        setData(sorted)
      })
      .finally(() => setLoading(false))
  }, [projectId])

  function getWeekNumber(date: Date): string {
    const d = new Date(date)
    d.setHours(0,0,0,0)
    d.setDate(d.getDate() + 4 - (d.getDay() || 7))
    const yearStart = new Date(d.getFullYear(), 0, 1)
    return String(Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7))
  }

  if (loading) return <div className="h-48 flex items-center justify-center text-sm text-gray-400">Loading velocity...</div>
  if (data.length === 0) return <div className="h-48 flex items-center justify-center text-sm text-gray-400">No velocity data yet</div>

  const avg = data.length > 0 ? data.reduce((s, d) => s + d.completed, 0) / data.length : 0
  const recent = data[data.length - 1]?.completed || 0
  const prev = data[data.length - 2]?.completed || recent
  const trend = recent - prev

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-700">Sprint Velocity</h4>
          <p className="text-xs text-gray-400">Story points completed per week</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">{avg.toFixed(0)} avg pts/wk</span>
          {trend > 0 ? <TrendingUp size={16} className="text-green-500" />
            : trend < 0 ? <TrendingDown size={16} className="text-red-500" />
            : <Minus size={16} className="text-gray-400" />}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc', fontSize: 12 }}
            formatter={(val: number, name: string) => [val, name === 'completed' ? 'Points Done' : 'Points Added']}
          />
          <ReferenceLine y={avg} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'avg', fill: '#94a3b8', fontSize: 10 }} />
          <Bar dataKey="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} name="completed" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
