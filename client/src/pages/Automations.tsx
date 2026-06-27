import { useEffect, useState } from 'react'
import { Plus, Trash2, Workflow, Zap, Bell, MessageSquare, Flag } from 'lucide-react'
import { automationsApi, projectsApi, resourcesApi } from '../api'
import { Project, User } from '../types'
import Modal from '../components/ui/Modal'
import { format, parseISO } from 'date-fns'

interface AutomationRule {
  id: number
  project_id: number | null
  project_name: string | null
  name: string
  trigger_type: string
  conditions: string | null
  action_type: string
  action_config: string | null
  enabled: number
  fire_count: number
  last_fired_at: string | null
  created_by_name: string | null
}

const TRIGGER_LABELS: Record<string, string> = {
  task_created: 'Task is created',
  task_status_changed: 'Task status changes',
  task_assigned: 'Task is assigned',
  risk_created: 'Risk is identified',
  risk_updated: 'Risk is updated',
  project_health_red: 'Project health turns red',
  project_health_improved: 'Project health recovers',
  task_overdue: 'Task becomes overdue',
  budget_overrun: 'Project exceeds its budget',
  milestone_missed: 'Milestone is missed',
}

const ACTION_LABELS: Record<string, string> = {
  notify_manager: 'Notify project manager',
  notify_user: 'Notify a specific user',
  set_task_priority: 'Set task priority',
  add_comment: 'Add comment to task',
}

const ACTION_ICONS: Record<string, typeof Bell> = {
  notify_manager: Bell,
  notify_user: Bell,
  set_task_priority: Flag,
  add_comment: MessageSquare,
}

const STATUSES = ['todo', 'in_progress', 'review', 'blocked', 'done']
const PRIORITIES = ['low', 'medium', 'high', 'critical']

function describeConditions(rule: AutomationRule): string {
  if (!rule.conditions) return 'Always'
  try {
    const c = JSON.parse(rule.conditions)
    const parts: string[] = []
    if (c.to_status) parts.push(`status → ${c.to_status.replace('_', ' ')}`)
    if (c.from_status) parts.push(`from ${c.from_status.replace('_', ' ')}`)
    if (c.priority_in?.length) parts.push(`priority in [${c.priority_in.join(', ')}]`)
    if (c.min_score != null) parts.push(`score ≥ ${c.min_score}`)
    return parts.length ? parts.join(' · ') : 'Always'
  } catch {
    return 'Always'
  }
}

export default function Automations() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const fetchRules = () => automationsApi.list().then(r => setRules(r.data.rules)).finally(() => setLoading(false))

  useEffect(() => {
    fetchRules()
    projectsApi.list().then(r => setProjects(r.data.projects))
    resourcesApi.users().then(r => setUsers(r.data.users))
  }, [])

  const handleToggle = async (rule: AutomationRule) => {
    await automationsApi.toggle(rule.id)
    fetchRules()
  }

  const handleDelete = async (rule: AutomationRule) => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return
    await automationsApi.delete(rule.id)
    fetchRules()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {rules.filter(r => r.enabled).length} active rules · {rules.reduce((s, r) => s + r.fire_count, 0)} total runs
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={16} /> New Rule
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Workflow size={48} className="mx-auto mb-3 opacity-30" />
          <p>No automation rules yet. Create one to automate your workflow.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => {
            const ActionIcon = ACTION_ICONS[rule.action_type] || Zap
            return (
              <div key={rule.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 transition-opacity ${rule.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${rule.enabled ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                  <ActionIcon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    <span className="font-medium">When</span> {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                    {' '}<span className="text-gray-400">({describeConditions(rule)})</span>
                    {' '}<span className="font-medium">then</span> {ACTION_LABELS[rule.action_type] || rule.action_type}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Scope: {rule.project_name || 'All projects'} · Fired {rule.fire_count}×
                    {rule.last_fired_at && ` · Last: ${format(parseISO(rule.last_fired_at), 'MMM d, HH:mm')}`}
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(rule)}
                  className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${rule.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                  title={rule.enabled ? 'Disable' : 'Enable'}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${rule.enabled ? 'translate-x-4' : ''}`} />
                </button>
                <button onClick={() => handleDelete(rule)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Automation Rule" size="lg">
        <RuleForm projects={projects} users={users} onDone={() => { setShowCreate(false); fetchRules() }} onCancel={() => setShowCreate(false)} />
      </Modal>
    </div>
  )
}

function RuleForm({ projects, users, onDone, onCancel }: { projects: Project[]; users: User[]; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [projectId, setProjectId] = useState('')
  const [trigger, setTrigger] = useState('task_status_changed')
  const [toStatus, setToStatus] = useState('')
  const [priorityIn, setPriorityIn] = useState<string[]>([])
  const [minScore, setMinScore] = useState('')
  const [action, setAction] = useState('notify_manager')
  const [actionUserId, setActionUserId] = useState('')
  const [actionPriority, setActionPriority] = useState('high')
  const [actionComment, setActionComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isTaskTrigger = trigger.startsWith('task')
  const isRiskTrigger = trigger.startsWith('risk')
  const isOverdueTrigger = trigger === 'task_overdue'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Rule name is required'); return }

    const conditions: Record<string, unknown> = {}
    if (isTaskTrigger) {
      if (toStatus) conditions.to_status = toStatus
      if (priorityIn.length) conditions.priority_in = priorityIn
    } else if (isRiskTrigger && minScore) {
      conditions.min_score = Number(minScore)
    }

    let actionConfig: Record<string, unknown> | null = null
    if (action === 'notify_user') {
      if (!actionUserId) { setError('Select a user to notify'); return }
      actionConfig = { user_id: Number(actionUserId) }
    } else if (action === 'set_task_priority') {
      actionConfig = { priority: actionPriority }
    } else if (action === 'add_comment') {
      if (!actionComment.trim()) { setError('Comment text is required'); return }
      actionConfig = { content: actionComment.trim() }
    }

    setSaving(true)
    setError('')
    try {
      await automationsApi.create({
        name: name.trim(),
        project_id: projectId ? Number(projectId) : null,
        trigger_type: trigger,
        conditions: Object.keys(conditions).length ? conditions : null,
        action_type: action,
        action_config: actionConfig,
      })
      onDone()
    } catch {
      setError('Failed to create rule')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Rule name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Notify manager when tasks complete" className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Scope</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputCls}>
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">When (trigger)</label>
          <select value={trigger} onChange={e => setTrigger(e.target.value)} className={inputCls}>
            {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
        <div className="text-xs font-semibold text-gray-500 uppercase">Conditions (optional)</div>
        {isTaskTrigger ? (
          <div className="grid grid-cols-2 gap-4">
            {!isOverdueTrigger && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status becomes</label>
                <select value={toStatus} onChange={e => setToStatus(e.target.value)} className={inputCls}>
                  <option value="">Any</option>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Priority is one of</label>
              <div className="flex gap-2 flex-wrap pt-1.5">
                {PRIORITIES.map(p => (
                  <label key={p} className="flex items-center gap-1 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={priorityIn.includes(p)}
                      onChange={e => setPriorityIn(prev => e.target.checked ? [...prev, p] : prev.filter(x => x !== p))}
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : isRiskTrigger ? (
          <div className="w-1/2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Minimum risk score (1–16)</label>
            <input type="number" min={1} max={16} value={minScore} onChange={e => setMinScore(e.target.value)} placeholder="e.g. 6" className={inputCls} />
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            No conditions — this rule fires once, on the daily check, when {
              trigger === 'budget_overrun'
                ? "a project's spend first exceeds its budget"
                : trigger === 'milestone_missed'
                  ? 'a milestone slips past its target date without being achieved'
                  : trigger === 'project_health_improved'
                    ? "the project's daily health snapshot climbs back out of the red band"
                    : "the project's daily health snapshot crosses into the red band"
            }.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Then (action)</label>
          <select value={action} onChange={e => setAction(e.target.value)} className={inputCls}>
            {Object.entries(ACTION_LABELS)
              .filter(([k]) => isTaskTrigger || (k !== 'set_task_priority' && k !== 'add_comment'))
              .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          {action === 'notify_user' && (
            <>
              <label className="block text-xs font-medium text-gray-500 mb-1">User</label>
              <select value={actionUserId} onChange={e => setActionUserId(e.target.value)} className={inputCls}>
                <option value="">Select user…</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </>
          )}
          {action === 'set_task_priority' && (
            <>
              <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
              <select value={actionPriority} onChange={e => setActionPriority(e.target.value)} className={inputCls}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </>
          )}
          {action === 'add_comment' && (
            <>
              <label className="block text-xs font-medium text-gray-500 mb-1">Comment text</label>
              <input value={actionComment} onChange={e => setActionComment(e.target.value)} placeholder="e.g. Please review QA checklist" className={inputCls} />
            </>
          )}
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Creating…' : 'Create Rule'}
        </button>
      </div>
    </form>
  )
}
