import { useEffect, useState } from 'react'
import { evmApi } from '../api'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'
import { TrendingDown } from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface BurndownData {
  date: string
  ideal: number
  actual: number
  completed: number
}

interface BurndownChartProps {
  projectId: number
}

export default function BurndownChart({ projectId }: BurndownChartProps) {
  const [data, setData] = useState<{ burndown: BurndownData[]; totalPoints: number; project: { name: string; color: string } } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    evmApi.burndown(projectId)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!data || data.burndown.length === 0) return (
    <div className="text-center py-8 text-sm text-gray-400">Not enough data for burndown chart</div>
  )

  const lastActual = data.burndown[data.burndown.length - 1]?.actual || 0
  const trend = lastActual > (data.burndown[0]?.ideal || 0) / 2 ? 'behind' : 'ahead'

  const chartData = data.burndown.map(d => ({
    ...d,
    date: format(parseISO(d.date), 'MMM d'),
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingDown size={16} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Burndown Chart</span>
          <span className="text-xs text-gray-400">({data.totalPoints} total points)</span>
        </div>
        <div className={`text-xs px-2 py-0.5 rounded font-medium ${trend === 'ahead' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {lastActual} pts remaining · {trend === 'ahead' ? 'On track' : 'Behind schedule'}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="idealGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} domain={[0, data.totalPoints]} />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value} pts`,
              name === 'ideal' ? 'Ideal Remaining' : 'Actual Remaining',
            ]}
          />
          <Legend formatter={v => v === 'ideal' ? 'Ideal' : 'Actual'} />
          <Area type="monotone" dataKey="ideal" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 3" fill="url(#idealGrad)" dot={false} />
          <Area type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2.5} fill="url(#actualGrad)" dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
