import { useEffect, useState } from 'react'
import { Webhook as WebhookIcon, Plus, Trash2, Send, CheckCircle, XCircle } from 'lucide-react'
import Card from './ui/Card'
import { webhooksApi, projectsApi } from '../api'
import { Webhook, Project } from '../types'

const fmtSqlDate = (s: string) => new Date(s.replace(' ', 'T') + 'Z').toLocaleString()

export default function WebhooksManager() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [availableEvents, setAvailableEvents] = useState<string[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [showForm, setShowForm] = useState(false)
  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [events, setEvents] = useState<string[]>([])
  const [projectId, setProjectId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState<Record<number, string>>({})

  const load = async () => {
    try {
      const res = await webhooksApi.list()
      setWebhooks(res.data.webhooks)
      setAvailableEvents(res.data.available_events)
    } catch { /* non-admin */ }
  }

  useEffect(() => {
    load()
    projectsApi.list().then(r => setProjects(r.data.projects)).catch(() => {})
  }, [])

  const create = async () => {
    setError('')
    setSaving(true)
    try {
      await webhooksApi.create({
        url: url.trim(),
        secret: secret.trim() || undefined,
        events,
        project_id: projectId ? Number(projectId) : null,
      })
      setUrl(''); setSecret(''); setEvents([]); setProjectId(''); setShowForm(false)
      await load()
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to create webhook')
    } finally { setSaving(false) }
  }

  const remove = async (id: number) => {
    if (!confirm('Delete this webhook?')) return
    await webhooksApi.delete(id)
    setWebhooks(prev => prev.filter(w => w.id !== id))
  }

  const toggle = async (w: Webhook) => {
    await webhooksApi.update(w.id, { enabled: !w.enabled })
    setWebhooks(prev => prev.map(x => x.id === w.id ? { ...x, enabled: x.enabled ? 0 : 1 } : x))
  }

  const test = async (id: number) => {
    setTestResult(prev => ({ ...prev, [id]: '...' }))
    try {
      const res = await webhooksApi.test(id)
      setTestResult(prev => ({ ...prev, [id]: res.data.delivered ? `OK (${res.data.status})` : `Failed (${res.data.status || 'no response'})` }))
    } catch {
      setTestResult(prev => ({ ...prev, [id]: 'Failed' }))
    }
    await load()
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <WebhookIcon size={18} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">Webhooks</h2>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
          <Plus size={12} /> Add Webhook
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        POST event payloads to external systems (Slack relays, CI, custom integrations).
        Payloads are signed with HMAC-SHA256 in the <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">X-PPT-Signature</code> header when a secret is set.
      </p>

      {showForm && (
        <div className="mb-4 p-4 border border-blue-200 bg-blue-50/40 rounded-lg space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Payload URL *</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/hooks/projectpulse" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Secret (optional)</label>
              <input value={secret} onChange={e => setSecret(e.target.value)} placeholder="Shared HMAC secret" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Scope</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Events *</label>
            <div className="flex flex-wrap gap-2">
              {availableEvents.map(ev => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => setEvents(prev => prev.includes(ev) ? prev.filter(x => x !== ev) : [...prev, ev])}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${events.includes(ev) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
                >
                  {ev}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={create} disabled={saving || !url.trim() || events.length === 0} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Webhook'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {webhooks.map(w => (
          <div key={w.id} className="border border-gray-200 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              {w.last_status !== null && (
                w.last_status >= 200 && w.last_status < 300
                  ? <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                  : <XCircle size={14} className="text-red-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{w.url}</div>
                <div className="text-xs text-gray-400">
                  {(JSON.parse(w.events) as string[]).join(', ')} · {w.project_name || 'all projects'}
                  {w.last_fired_at && ` · last fired ${fmtSqlDate(w.last_fired_at)}`}
                  {w.fail_count > 0 && <span className="text-red-500"> · {w.fail_count} consecutive failures</span>}
                </div>
              </div>
              {testResult[w.id] && <span className="text-xs text-gray-500">{testResult[w.id]}</span>}
              <button onClick={() => test(w.id)} className="p-1.5 text-gray-400 hover:text-blue-600" title="Send test ping">
                <Send size={14} />
              </button>
              <label className="relative inline-flex items-center cursor-pointer" title={w.enabled ? 'Enabled' : 'Disabled'}>
                <input type="checkbox" checked={!!w.enabled} onChange={() => toggle(w)} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </label>
              <button onClick={() => remove(w.id)} className="p-1.5 text-gray-400 hover:text-red-500" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {webhooks.length === 0 && <div className="text-sm text-gray-400 text-center py-3">No webhooks configured</div>}
      </div>
    </Card>
  )
}
