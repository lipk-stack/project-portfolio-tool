import { useEffect, useState } from 'react'
import { resourcesApi } from '../api'
import Card, { CardHeader } from './ui/Card'
import { CalendarClock } from 'lucide-react'

interface ForecastUser {
  id: number
  name: string
  department: string
  capacity: number
  weekly: Array<{ week: string; hours: number; pct: number }>
}

function cellColor(pct: number): string {
  if (pct === 0) return 'bg-gray-50 text-gray-300'
  if (pct < 60) return 'bg-green-50 text-green-700'
  if (pct < 85) return 'bg-green-100 text-green-800'
  if (pct <= 100) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-700 font-semibold'
}

export default function CapacityForecast() {
  const [weeks, setWeeks] = useState<string[]>([])
  const [forecast, setForecast] = useState<ForecastUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    resourcesApi.capacityForecast(12).then(r => {
      setWeeks(r.data.weeks)
      setForecast(r.data.forecast)
    }).finally(() => setLoading(false))
  }, [])

  if (loading || forecast.length === 0) return null

  return (
    <Card>
      <CardHeader
        title="Capacity Forecast"
        subtitle="Projected workload (% of weekly capacity) over the next 12 weeks, from remaining task estimates"
        icon={CalendarClock}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left py-2 pr-3 font-medium text-gray-500 sticky left-0 bg-white">Resource</th>
              {weeks.map(w => (
                <th key={w} className="px-1 py-2 font-medium text-gray-400 whitespace-nowrap">{w.slice(5)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {forecast.map(u => (
              <tr key={u.id} className="border-t border-gray-100">
                <td className="py-1.5 pr-3 sticky left-0 bg-white">
                  <div className="font-medium text-gray-800 whitespace-nowrap">{u.name}</div>
                  <div className="text-gray-400">{u.department} · {u.capacity}h/wk</div>
                </td>
                {u.weekly.map(w => (
                  <td key={w.week} className="px-1 py-1.5">
                    <div
                      className={`flex items-center justify-center h-8 min-w-10 rounded ${cellColor(w.pct)}`}
                      title={`Week of ${w.week}: ${w.hours}h forecast (${w.pct}% of capacity)`}
                    >
                      {w.pct > 0 ? `${w.pct}%` : '—'}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100" /> Healthy (&lt;85%)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-100" /> Near capacity (85–100%)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100" /> Overallocated (&gt;100%)</span>
      </div>
    </Card>
  )
}
