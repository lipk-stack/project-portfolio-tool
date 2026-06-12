import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, AlertCircle, Camera, RotateCcw, DollarSign, Clock, Target, Activity, LucideIcon } from 'lucide-react'
import { evmApi } from '../api'
import { EVMResponse } from '../types'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function MetricCard({ label, value, sub, icon: Icon, tone = 'gray' }: { label: string; value: string; sub?: string; icon: LucideIcon; tone?: 'green' | 'red' | 'yellow' | 'gray' | 'blue' }) {
  const toneClass = {
    green: 'text-green-600 bg-green-50',
    red: 'text-red-600 bg-red-50',
    yellow: 'text-yellow-700 bg-yellow-50',
    blue: 'text-blue-600 bg-blue-50',
    gray: 'text-gray-600 bg-gray-50',
  }[tone]
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
          {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
        </div>
        <div className={`p-2 rounded-lg ${toneClass}`}><Icon size={16} /></div>
      </div>
    </div>
  )
}

export default function EVMDashboard({ projectId, hasBaseline, onBaselineChange }: { projectId: number; hasBaseline: boolean; onBaselineChange: () => void }) {
  const [data, setData] = useState<EVMResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await evmApi.project(projectId)
      setData(res.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [projectId])

  const captureBaseline = async () => {
    if (!confirm('Capture current schedule and budget as the project baseline? This overwrites any existing baseline.')) return
    setActing(true)
    try {
      await evmApi.captureBaseline(projectId)
      onBaselineChange()
      await load()
    } finally { setActing(false) }
  }

  const clearBaseline = async () => {
    if (!confirm('Clear the project baseline? EVM forecasts will fall back to the current plan.')) return
    setActing(true)
    try {
      await evmApi.clearBaseline(projectId)
      onBaselineChange()
      await load()
    } finally { setActing(false) }
  }

  if (loading || !data) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const { metrics, interpretation, sCurve, earnedSchedule: es } = data
  const cpiTone = metrics.CPI >= 1 ? 'green' : metrics.CPI >= 0.95 ? 'yellow' : 'red'
  const spiTone = metrics.SPI >= 1 ? 'green' : metrics.SPI >= 0.95 ? 'yellow' : 'red'
  const healthBadge = {
    green: { color: 'bg-green-100 text-green-700 border-green-300', label: 'Healthy' },
    yellow: { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', label: 'At Risk' },
    red: { color: 'bg-red-100 text-red-700 border-red-300', label: 'Critical' },
  }[interpretation.health]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Earned Value Analysis</h2>
          <p className="text-sm text-gray-500">PMBOK-standard cost & schedule performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${healthBadge.color}`}>
            {healthBadge.label}
          </span>
          {hasBaseline ? (
            <button onClick={clearBaseline} disabled={acting} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              <RotateCcw size={14} /> Clear Baseline
            </button>
          ) : (
            <button onClick={captureBaseline} disabled={acting} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Camera size={14} /> Capture Baseline
            </button>
          )}
        </div>
      </div>

      {!hasBaseline && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <div>No baseline captured. EVM is calculated using the current plan. Capture a baseline to track variance against the originally planned schedule and budget.</div>
        </div>
      )}

      {/* Core EVM cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Budget at Completion (BAC)" value={fmtMoney(metrics.BAC)} icon={DollarSign} tone="gray" />
        <MetricCard label="Earned Value (EV)" value={fmtMoney(metrics.EV)} sub={`${metrics.completionPercent}% complete`} icon={Target} tone="blue" />
        <MetricCard label="Planned Value (PV)" value={fmtMoney(metrics.PV)} sub={`${metrics.plannedPercent}% planned`} icon={Clock} tone="gray" />
        <MetricCard label="Actual Cost (AC)" value={fmtMoney(metrics.AC)} icon={Activity} tone="gray" />
      </div>

      {/* Performance indices */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Cost Performance (CPI)" value={metrics.CPI.toFixed(2)} sub={metrics.CPI >= 1 ? 'Under budget' : 'Over budget'} icon={metrics.CPI >= 1 ? TrendingUp : TrendingDown} tone={cpiTone} />
        <MetricCard label="Schedule Performance (SPI)" value={metrics.SPI.toFixed(2)} sub={metrics.SPI >= 1 ? 'Ahead of plan' : 'Behind schedule'} icon={metrics.SPI >= 1 ? TrendingUp : TrendingDown} tone={spiTone} />
        <MetricCard label="Cost Variance (CV)" value={fmtMoney(metrics.CV)} sub={metrics.CV >= 0 ? 'Favorable' : 'Unfavorable'} icon={DollarSign} tone={metrics.CV >= 0 ? 'green' : 'red'} />
        <MetricCard label="Schedule Variance (SV)" value={fmtMoney(metrics.SV)} sub={metrics.SV >= 0 ? 'Ahead' : 'Behind'} icon={Clock} tone={metrics.SV >= 0 ? 'green' : 'red'} />
      </div>

      {/* Forecasts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Estimate at Completion (EAC)" value={fmtMoney(metrics.EAC)} sub={metrics.VAC >= 0 ? `${fmtMoney(metrics.VAC)} under` : `${fmtMoney(-metrics.VAC)} over`} icon={Target} tone={metrics.VAC >= 0 ? 'green' : 'red'} />
        <MetricCard label="Estimate to Complete (ETC)" value={fmtMoney(metrics.ETC)} sub="Remaining work cost" icon={DollarSign} tone="gray" />
        <MetricCard label="Variance at Completion (VAC)" value={fmtMoney(metrics.VAC)} sub={metrics.VAC >= 0 ? 'Surplus' : 'Overrun'} icon={metrics.VAC >= 0 ? TrendingUp : TrendingDown} tone={metrics.VAC >= 0 ? 'green' : 'red'} />
        <MetricCard label="To-Complete Performance (TCPI)" value={metrics.TCPI.toFixed(2)} sub={metrics.TCPI <= 1 ? 'Achievable' : 'Aggressive'} icon={Activity} tone={metrics.TCPI <= 1 ? 'green' : 'yellow'} />
      </div>

      {/* Earned schedule (time-based) */}
      {es && (
        <div>
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-gray-900">Earned Schedule (Time-Based)</h3>
            <p className="text-xs text-gray-500">SPI(t) stays meaningful late in the project, where classic SPI converges to 1</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Earned Schedule (ES)" value={`${es.earnedScheduleDays}d`} sub={`of ${es.plannedDurationDays}d planned · ${es.actualTimeDays}d elapsed`} icon={Clock} tone="blue" />
            <MetricCard label="Schedule Performance SPI(t)" value={es.SPIt.toFixed(2)} sub={es.SPIt >= 1 ? 'Ahead of plan' : 'Behind plan'} icon={es.SPIt >= 1 ? TrendingUp : TrendingDown} tone={es.SPIt >= 1 ? 'green' : es.SPIt >= 0.95 ? 'yellow' : 'red'} />
            <MetricCard label="Time Variance TV(t)" value={`${es.timeVarianceDays > 0 ? '+' : ''}${es.timeVarianceDays}d`} sub={es.timeVarianceDays >= 0 ? 'Ahead' : 'Behind'} icon={Clock} tone={es.timeVarianceDays >= 0 ? 'green' : 'red'} />
            <MetricCard label="Forecast Completion" value={es.forecastEndDate} sub={es.forecastSlipDays === 0 ? 'On the planned date' : es.forecastSlipDays > 0 ? `${es.forecastSlipDays}d late` : `${-es.forecastSlipDays}d early`} icon={Target} tone={es.forecastSlipDays <= 0 ? 'green' : 'red'} />
          </div>
        </div>
      )}

      {/* S-Curve chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">S-Curve: Planned vs Earned vs Actual</h3>
            <p className="text-xs text-gray-500">Cumulative cost over project lifecycle</p>
          </div>
          {metrics.scheduleSlipDays !== 0 && (
            <div className={`text-sm font-medium px-3 py-1 rounded-lg ${metrics.scheduleSlipDays > 0 ? 'text-red-700 bg-red-50' : 'text-green-700 bg-green-50'}`}>
              Forecast: {metrics.scheduleSlipDays > 0 ? `+${metrics.scheduleSlipDays}d slip` : `${metrics.scheduleSlipDays}d ahead`}
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={sCurve} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: number) => fmtMoney(v)} />
            <Legend />
            <ReferenceLine y={metrics.BAC} stroke="#9ca3af" strokeDasharray="4 4" label={{ value: 'BAC', position: 'right', fontSize: 10 }} />
            <Line type="monotone" dataKey="planned" name="Planned Value (PV)" stroke="#9ca3af" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="earned" name="Earned Value (EV)" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="actual" name="Actual Cost (AC)" stroke="#ef4444" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Interpretation summary */}
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Executive Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Cost Performance</div>
            <p className="text-sm text-gray-700">
              {metrics.CPI >= 1
                ? `The project is delivering ${(metrics.CPI * 100 - 100).toFixed(1)}% more value per dollar than planned. For every $1 spent, $${metrics.CPI.toFixed(2)} of value has been earned.`
                : `Cost overrun: every $1 spent is delivering only $${metrics.CPI.toFixed(2)} of value. Forecast overspend of ${fmtMoney(Math.max(0, -metrics.VAC))}.`}
            </p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Schedule Performance</div>
            <p className="text-sm text-gray-700">
              {metrics.SPI >= 1
                ? `The team is ahead of schedule by ${(metrics.SPI * 100 - 100).toFixed(1)}%. Earned value exceeds planned value by ${fmtMoney(metrics.SV)}.`
                : `The team is behind schedule by ${(100 - metrics.SPI * 100).toFixed(1)}%. Projected slip: ${metrics.scheduleSlipDays} days.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
