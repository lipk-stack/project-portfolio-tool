import { useState } from 'react'
import { FlaskConical, RotateCcw, TrendingDown, TrendingUp, CalendarClock, DollarSign } from 'lucide-react'
import { scenarioApi } from '../api'
import { Task, ScenarioResult } from '../types'
import { format, parseISO } from 'date-fns'

function fmtDate(d: string | null) {
  return d ? format(parseISO(d), 'MMM d, yyyy') : '—'
}

function fmtMoney(n: number) {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`
  return `${sign}$${abs}`
}

interface Props {
  projectId: number
  tasks: Task[]
}

// What-if scenario planning: stage hypothetical shifts/extensions on open
// tasks, simulate the dependency ripple server-side, and compare the outcome
// against the current plan. Nothing is persisted.
export default function ScenarioPlanner({ projectId, tasks }: Props) {
  const [changes, setChanges] = useState<Record<number, { shift_days?: number; duration_delta_days?: number }>>({})
  const [result, setResult] = useState<ScenarioResult | null>(null)
  const [simulating, setSimulating] = useState(false)

  const openTasks = tasks.filter(t => t.status !== 'done' && t.start_date && t.end_date)

  const setChange = (taskId: number, key: 'shift_days' | 'duration_delta_days', raw: string) => {
    const value = raw === '' ? undefined : Number(raw)
    setChanges(prev => {
      const next = { ...prev, [taskId]: { ...prev[taskId], [key]: value } }
      if (next[taskId].shift_days === undefined && next[taskId].duration_delta_days === undefined) {
        delete next[taskId]
      }
      return next
    })
  }

  const simulate = async () => {
    const changeList = Object.entries(changes)
      .map(([id, c]) => ({ task_id: Number(id), ...c }))
      .filter(c => c.shift_days || c.duration_delta_days)
    if (changeList.length === 0) return
    setSimulating(true)
    try {
      const res = await scenarioApi.simulate(projectId, changeList)
      setResult(res.data)
    } finally { setSimulating(false) }
  }

  const reset = () => { setChanges({}); setResult(null) }

  const resultMap = new Map(result?.tasks.map(t => [t.id, t]) || [])
  const hasChanges = Object.keys(changes).length > 0

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <FlaskConical size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-900">
          <span className="font-semibold">What-if scenario planning.</span> Shift or extend open tasks and simulate the impact on the schedule and cost.
          Delays ripple through task dependencies. Nothing is saved — this is a sandbox.
        </div>
      </div>

      {result && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><CalendarClock size={12} /> Current End</div>
            <div className="font-bold text-gray-900">{fmtDate(result.summary.old_end)}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><CalendarClock size={12} /> Scenario End</div>
            <div className={`font-bold ${result.summary.end_delta_days > 0 ? 'text-red-600' : result.summary.end_delta_days < 0 ? 'text-green-600' : 'text-gray-900'}`}>
              {fmtDate(result.summary.new_end)}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
              {result.summary.end_delta_days > 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />} Schedule Impact
            </div>
            <div className={`font-bold ${result.summary.end_delta_days > 0 ? 'text-red-600' : result.summary.end_delta_days < 0 ? 'text-green-600' : 'text-gray-900'}`}>
              {result.summary.end_delta_days > 0 ? '+' : ''}{result.summary.end_delta_days} days
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><DollarSign size={12} /> Cost Impact</div>
            <div className={`font-bold ${result.summary.cost_delta > 0 ? 'text-red-600' : result.summary.cost_delta < 0 ? 'text-green-600' : 'text-gray-900'}`}>
              {result.summary.cost_delta > 0 ? '+' : ''}{fmtMoney(result.summary.cost_delta)}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Task</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden md:table-cell">Current Schedule</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 w-28">Shift (days)</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 w-28">Extend (days)</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Scenario Schedule</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {openTasks.map(task => {
              const r = resultMap.get(task.id)
              const c = changes[task.id]
              return (
                <tr key={task.id} className={r?.changed ? 'bg-amber-50/50' : ''}>
                  <td className="px-4 py-2.5">
                    <div className="text-sm font-medium text-gray-800">{task.name}</div>
                    {task.wbs_code && <div className="text-xs text-gray-400">{task.wbs_code}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 hidden md:table-cell whitespace-nowrap">
                    {fmtDate(task.start_date!)} – {fmtDate(task.end_date!)}
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      value={c?.shift_days ?? ''}
                      onChange={e => setChange(task.id, 'shift_days', e.target.value)}
                      placeholder="0"
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      value={c?.duration_delta_days ?? ''}
                      onChange={e => setChange(task.id, 'duration_delta_days', e.target.value)}
                      placeholder="0"
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                    {r && r.changed ? (
                      <span className={r.delta_days > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                        {fmtDate(r.new_start)} – {fmtDate(r.new_end)}
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-white border border-current">
                          {r.delta_days > 0 ? '+' : ''}{r.delta_days}d{!r.directly_changed && ' (ripple)'}
                        </span>
                      </span>
                    ) : r ? (
                      <span className="text-gray-400">unchanged</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {openTasks.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No open scheduled tasks to simulate</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={simulate}
          disabled={!hasChanges || simulating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <FlaskConical size={14} /> {simulating ? 'Simulating...' : 'Run Simulation'}
        </button>
        <button
          onClick={reset}
          disabled={!hasChanges && !result}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </div>
  )
}
