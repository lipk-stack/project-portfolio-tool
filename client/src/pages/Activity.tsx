import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { History, CheckCircle, AlertTriangle, PlusCircle, ArrowRightLeft, Activity as ActivityIcon } from 'lucide-react'
import { activityApi, projectsApi } from '../api'
import { ActivityEntry, Project } from '../types'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import { formatDistanceToNow } from 'date-fns'

const PAGE_SIZE = 50

const ACTION_META: Record<string, { label: string; icon: typeof History; color: string }> = {
  task_created: { label: 'Task created', icon: PlusCircle, color: 'text-blue-600 bg-blue-50' },
  task_status_changed: { label: 'Status changed', icon: ArrowRightLeft, color: 'text-purple-600 bg-purple-50' },
  task_completed: { label: 'Task completed', icon: CheckCircle, color: 'text-green-600 bg-green-50' },
  risk_raised: { label: 'Risk raised', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
}

function fmtSqlDate(s: string): Date {
  return new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z')
}

function describeDetails(action: string, details: string | null): string {
  if (!details) return ''
  try {
    const d = JSON.parse(details) as Record<string, string>
    if (action === 'task_status_changed') return `"${d.task}" moved from ${d.from} to ${d.to}`
    if (d.task) return `"${d.task}"`
    if (d.name) return `"${d.name}"`
    if (d.title) return `"${d.title}"`
    return ''
  } catch {
    return ''
  }
}

export default function Activity() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [total, setTotal] = useState(0)
  const [actions, setActions] = useState<string[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectFilter, setProjectFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (offset: number) => {
    const res = await activityApi.list({
      limit: PAGE_SIZE,
      offset,
      ...(projectFilter ? { project_id: Number(projectFilter) } : {}),
      ...(actionFilter ? { action: actionFilter } : {}),
    })
    setEntries(prev => offset === 0 ? res.data.entries : [...prev, ...res.data.entries])
    setTotal(res.data.total)
    setActions(res.data.actions)
  }, [projectFilter, actionFilter])

  useEffect(() => {
    setLoading(true)
    load(0).finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    projectsApi.list().then(r => setProjects(r.data.projects)).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-sm text-gray-500 mt-1">Full audit trail of changes across all projects</p>
        </div>
        <div className="flex gap-2">
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All actions</option>
            {actions.map(a => <option key={a} value={a}>{ACTION_META[a]?.label || a.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            <ActivityIcon size={32} className="mx-auto mb-2 opacity-50" />
            No activity matches these filters
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {entries.map(e => {
              const meta = ACTION_META[e.action] || { label: e.action.replace(/_/g, ' '), icon: History, color: 'text-gray-600 bg-gray-50' }
              const Icon = meta.icon
              const detail = describeDetails(e.action, e.details)
              return (
                <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <div className={`p-2 rounded-lg ${meta.color} flex-shrink-0`}><Icon size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800">
                      <span className="font-medium">{e.user_name || 'System'}</span>
                      {' '}<span className="text-gray-500">{meta.label.toLowerCase()}</span>
                      {detail && <span> {detail}</span>}
                      {e.project_name && (
                        <span className="text-gray-500"> in <Link to={`/projects/${e.entity_id}`} className="text-blue-600 hover:underline">{e.project_name}</Link></span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{formatDistanceToNow(fmtSqlDate(e.created_at), { addSuffix: true })}</div>
                  </div>
                  {e.user_name && <Avatar name={e.user_name} size="sm" />}
                </div>
              )
            })}
          </div>
        )}
        {!loading && entries.length < total && (
          <div className="border-t border-gray-100 p-3 text-center">
            <button onClick={() => load(entries.length)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Load more ({total - entries.length} remaining)
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}
