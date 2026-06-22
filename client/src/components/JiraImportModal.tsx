import { useState } from 'react'
import { Ticket, Upload, AlertTriangle, CheckCircle2, CopyMinus } from 'lucide-react'
import Modal from './ui/Modal'
import { tasksApi } from '../api'

interface PreviewRow { row: number; name: string; status: string; priority: string; wbs_code: string | null; errors: string[] }
interface PreviewData {
  validCount: number
  errorCount: number
  skipped?: number
  rows: PreviewRow[]
  project?: string
  fetched?: number
  importable?: number
}

interface Props {
  projectId: number
  onClose: () => void
  onImported: () => void
}

// Inbound Jira issue importer: enter your Jira site, credentials and a project
// key (or JQL), preview the mapped tasks (dry run), then commit. Mirrors the
// GitHub importer's preview→commit flow. Assignee emails resolve to local users;
// issues already imported (by Jira key) are skipped on re-import.
export default function JiraImportModal({ projectId, onClose, onImported }: Props) {
  const [baseUrl, setBaseUrl] = useState('')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [project, setProject] = useState('')
  const [jql, setJql] = useState('')
  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready = baseUrl.trim() && email.trim() && token.trim() && (project.trim() || jql.trim())
  const opts = (commit: boolean) => ({
    baseUrl: baseUrl.trim(), email: email.trim(), token: token.trim(),
    project: project.trim() || undefined, jql: jql.trim() || undefined, commit,
  })

  const runPreview = async () => {
    if (!ready) return
    setLoading(true); setError(null); setData(null)
    try {
      const res = await tasksApi.importJira(projectId, opts(false))
      setData(res.data)
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Could not fetch issues from Jira.')
    } finally {
      setLoading(false)
    }
  }

  const doCommit = async () => {
    setLoading(true); setError(null)
    try {
      await tasksApi.importJira(projectId, opts(true))
      onImported(); onClose()
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Import failed. Please try again.')
      setLoading(false)
    }
  }

  const newCount = data ? data.validCount - (data.skipped || 0) : 0

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Import Tasks from Jira"
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={doCommit}
            disabled={loading || !data || newCount === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Upload size={14} className="inline mr-1.5 -mt-0.5" />
            Import {data ? `${newCount} task${newCount === 1 ? '' : 's'}` : ''}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          Pull issues from a Jira Cloud project. Status maps from Jira's status category
          (<span className="font-mono text-xs">To Do → todo, In Progress → in_progress, Done → done</span>) and priority from the Jira
          priority. The <strong>assignee email</strong> is matched to a local user. Create an API token at{' '}
          <span className="font-mono text-xs">id.atlassian.com/manage-profile/security/api-tokens</span>. Issues you've imported before
          (matched by Jira key) are skipped, so re-running keeps tasks in sync without duplicates.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-sm">
            <span className="block text-gray-500 mb-1">Jira site URL</span>
            <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="your-site.atlassian.net"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="text-sm">
            <span className="block text-gray-500 mb-1">Account email</span>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="text-sm">
            <span className="block text-gray-500 mb-1">API token</span>
            <input value={token} onChange={e => setToken(e.target.value)} type="password" placeholder="Jira API token"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="text-sm">
            <span className="block text-gray-500 mb-1">Project key</span>
            <input value={project} onChange={e => setProject(e.target.value)} placeholder="PROJ"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="text-sm">
            <span className="block text-gray-500 mb-1">JQL (optional, overrides project)</span>
            <input value={jql} onChange={e => setJql(e.target.value)} placeholder='project = PROJ AND status != Done'
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={runPreview} disabled={loading || !ready} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Ticket size={14} /> {loading ? 'Fetching…' : 'Fetch & preview'}
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>

        {data && (
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center gap-4 mb-2 text-sm flex-wrap">
              <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 size={14} /> {newCount} new</span>
              {!!data.skipped && <span className="inline-flex items-center gap-1 text-amber-600"><CopyMinus size={14} /> {data.skipped} already imported</span>}
              {data.errorCount > 0 && <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle size={14} /> {data.errorCount} with errors</span>}
              <span className="text-gray-400">{data.project} · {data.fetched} fetched · {data.importable} importable</span>
            </div>
            {data.rows.length === 0 ? (
              <p className="text-sm text-gray-500">No importable issues found for those filters.</p>
            ) : (
              <div className="max-h-64 overflow-auto border border-gray-100 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left text-gray-500">
                      <th className="px-2 py-1.5">#</th>
                      <th className="px-2 py-1.5">Name</th>
                      <th className="px-2 py-1.5">Status</th>
                      <th className="px-2 py-1.5">Priority</th>
                      <th className="px-2 py-1.5">Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map(r => (
                      <tr key={r.row} className={`border-t border-gray-100 ${r.errors.length ? 'bg-red-50' : ''}`}>
                        <td className="px-2 py-1.5 text-gray-400">{r.row}</td>
                        <td className="px-2 py-1.5">{r.name}</td>
                        <td className="px-2 py-1.5">{r.status}</td>
                        <td className="px-2 py-1.5">{r.priority}</td>
                        <td className="px-2 py-1.5 text-gray-400">{r.wbs_code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
