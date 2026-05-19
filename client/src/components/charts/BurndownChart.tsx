import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format, parseISO } from 'date-fns'

interface BurndownData {
  date: string
  remaining: number
  ideal: number
}

interface Props {
  data: BurndownData[]
  totalPoints: number
  sprintName: string
}

export default function BurndownChart({ data, totalPoints, sprintName }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No burndown data available for this sprint
      </div>
    )
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const chartData = data.map(d => ({
    ...d,
    date: format(parseISO(d.date), 'MMM d'),
    isToday: d.date === todayStr,
  }))

  const completedPct = totalPoints > 0
    ? Math.round(((totalPoints - (data[data.length - 1]?.remaining || 0)) / totalPoints) * 100)
    : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">{sprintName} — Burndown</h4>
          <p className="text-xs text-gray-500">Points remaining vs ideal trajectory</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-800">{completedPct}%</div>
          <div className="text-xs text-gray-400">Complete</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={Math.floor(chartData.length / 6)} />
          <YAxis tick={{ fontSize: 11 }} domain={[0, totalPoints]} />
          <Tooltip
            formatter={(v: number, name: string) => [`${v} pts`, name === 'remaining' ? 'Actual Remaining' : 'Ideal Remaining']}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="ideal"
            name="Ideal"
            stroke="#94a3b8"
            strokeDasharray="6 3"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="remaining"
            name="Actual"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#3b82f6' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
