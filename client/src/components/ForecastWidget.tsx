import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Calendar, DollarSign, Clock } from 'lucide-react'
import { evmApi } from '../api'
import { format, parseISO } from 'date-fns'

interface ForecastWidgetProps {
  projectId: number
  scheduledEnd?: string
  budget: number
  spent: number
}

export default function ForecastWidget({ projectId, scheduledEnd, budget, spent }: ForecastWidgetProps) {
  const [forecast, setForecast] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    evmApi.forecast(projectId)
      .then(r => setForecast(r.data))
      .catch(() => setForecast(null))
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) return <div className="animate-pulse h-24 bg-gray-50 rounded-lg" />

  const remainingBudgetPct = budget > 0 ? Math.round((forecast?.remainingBudget ?? (budget - spent)) / budget * 100) : 0
  const schedVariance = forecast?.scheduleVarianceDays

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <TrendingUp size={14} className="text-blue-500" />
        Completion Forecast
      </h4>
      <div className="grid grid-cols-1 gap-3">
        {forecast?.projectedEnd && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <span className="text-xs text-gray-600">Projected Completion</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">
                {format(parseISO(forecast.projectedEnd), 'MMM d, yyyy')}
              </div>
              {schedVariance !== null && schedVariance !== undefined && (
                <div className={`text-xs font-medium ${schedVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {schedVariance > 0 ? `${schedVariance}d late` : schedVariance < 0 ? `${Math.abs(schedVariance)}d early` : 'On time'}
                </div>
              )}
            </div>
          </div>
        )}

        {forecast?.weeksUntilBudgetExhausted !== null && forecast?.weeksUntilBudgetExhausted !== undefined && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign size={14} className="text-gray-400" />
              <span className="text-xs text-gray-600">Budget runway</span>
            </div>
            <div className="text-right">
              <div className={`text-sm font-semibold ${forecast.weeksUntilBudgetExhausted < 4 ? 'text-red-600' : 'text-gray-900'}`}>
                {forecast.weeksUntilBudgetExhausted.toFixed(1)} weeks
              </div>
              <div className="text-xs text-gray-400">{remainingBudgetPct}% remaining</div>
            </div>
          </div>
        )}

        {forecast?.avgWeeklySpend > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-gray-400" />
              <span className="text-xs text-gray-600">Weekly burn rate</span>
            </div>
            <div className="text-sm font-medium text-gray-700">
              ${(forecast.avgWeeklySpend / 1000).toFixed(1)}K/wk
            </div>
          </div>
        )}

        {!forecast?.projectedEnd && !forecast?.avgWeeklySpend && (
          <div className="text-xs text-gray-400 text-center py-2">
            Log time entries to enable forecasting
          </div>
        )}
      </div>
    </div>
  )
}
