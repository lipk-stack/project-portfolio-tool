import { useEffect, useState } from 'react'
import { GitBranch, CalendarClock, Clock, AlertTriangle, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { tasksApi } from '../api'

// Critical Path Method view: surfaces the forward/backward-pass schedule computed
// server-side (server/src/lib/criticalPath.ts) — forecast finish, the critical
// chain, and per-task slack. "Total float" is how long a task can slip before the
// project end moves; "free float" is how long it can slip before its successor's
// early start moves. Critical tasks have zero total float.

interface CpTask {
  id: number
  name: string
  status: string
  completion_percent: number
  assignee_name: string | null
  duration: number
  totalFloat: number
  freeFloat: number
  isCritical: boolean
  earlyStart: string | null
  earlyFinish: string | null
}

interface CpResult {
  projectDuration: number
  hasCycle: boolean
  forecastFinish: string | null
  criticalCount: number
  criticalPath: Array<{ id: number; name: string }>
  tasks: CpTask[]
}

function fmtDate(d: string | null): string {
  return d ? format(parseISO(d), 'MMM d') : '—'
}

function fmtFloat(days: number): string {
  if (days === 0) return '0d'
  const rounded = Math.round(days * 10) / 10
  return `${rounded}d`
}

function floatClass(days: number): string {
  if (days <= 0) return 'text-red-600 font-semibold'
  if (days <= 2) return 'text-amber-600'
  return 'text-gray-500'
}

export default function CriticalPathPanel({ projectId }: { projectId: number }) {
  const [data, setData] = useState<CpResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    tasksApi
      .criticalPath(projectId)
      .then((r) => {
        if (active) setData(r.data)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [projectId])

  if (loading)
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  if (!data)
    return <div className="text-center text-gray-400 py-12">Schedule analysis unavailable</div>
  if (data.tasks.length === 0)
    return (
      <div className="text-center text-gray-400 py-12">
        Add tasks with dates and dependencies to compute the critical path.
      </div>
    )

  return (
    <div className="space-y-5">
      {data.hasCycle && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>
            The dependency network contains a cycle, so the schedule below is a best-effort
            estimate. Remove the circular dependency for an accurate critical path.
          </span>
        </div>
      )}

      {/* Headline metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <CalendarClock size={14} className="text-blue-500" /> Forecast finish
          </div>
          <div className="font-bold text-gray-900">
            {data.forecastFinish ? format(parseISO(data.forecastFinish), 'MMM d, yyyy') : '—'}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Clock size={14} className="text-violet-500" /> Schedule duration
          </div>
          <div className="font-bold text-gray-900">{data.projectDuration} days</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <GitBranch size={14} className="text-red-500" /> Critical tasks
          </div>
          <div className="font-bold text-gray-900">
            {data.criticalCount}{' '}
            <span className="text-sm font-normal text-gray-400">/ {data.tasks.length}</span>
          </div>
        </div>
      </div>

      {/* Critical chain */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <GitBranch size={16} className="text-red-500" /> Critical Path
        </h3>
        {data.criticalPath.length === 0 ? (
          <p className="text-sm text-gray-400">
            No critical chain — every task has schedule slack.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {data.criticalPath.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                  {t.name}
                </span>
                {i < data.criticalPath.length - 1 && (
                  <ChevronRight size={14} className="text-gray-300" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-task float table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Task</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden md:table-cell">
                Early window
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Duration</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">
                Total float
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3 hidden sm:table-cell">
                Free float
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.tasks.map((t) => (
              <tr key={t.id} className={t.isCritical ? 'bg-red-50/40' : 'hover:bg-gray-50'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {t.isCritical && (
                      <span
                        className="w-1.5 h-4 rounded bg-red-400 flex-shrink-0"
                        title="Critical"
                      />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-800">{t.name}</div>
                      {t.assignee_name && (
                        <div className="text-xs text-gray-400">{t.assignee_name}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                  {fmtDate(t.earlyStart)} → {fmtDate(t.earlyFinish)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 text-right">
                  {fmtFloat(t.duration)}
                </td>
                <td className={`px-4 py-3 text-sm text-right ${floatClass(t.totalFloat)}`}>
                  {fmtFloat(t.totalFloat)}
                </td>
                <td className="px-4 py-3 text-sm text-right hidden sm:table-cell text-gray-500">
                  {fmtFloat(t.freeFloat)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
