import { useState } from 'react'
import { Github, Upload, AlertTriangle, CheckCircle2, CopyMinus, RefreshCw } from 'lucide-react'
import Modal from './ui/Modal'
import { tasksApi } from '../api'

interface PreviewRow { row: number; name: string; status: string; priority: string; wbs_code: string | null; errors: string[] }
interface PreviewData {
  validCount: number
  errorCount: number
  imported?: number
  updated?: number
  skipped?: number
  rows: PreviewRow[]
  repo?: string
  fetched?: number
  importable?: number
}

interface Props {
  projectId: number
  onClose: () => void
  onImported: () => void
}

// Inbound GitHub issue importer: enter a repo, preview the mapped tasks (dry
// run), then commit. Mirrors the CSV ImportModal's preview→commit flow but the
// "source" is a live GitHub repo instead of pasted text. The server skips pull
// requests and maps issue state/labels onto task status/priority.
export default function GithubImportModal({ projectId, onClose, onImported }: Props) {
  const [repo, setRepo] = useState('')
  const [state, setState] = useState('open')
  const [labels, setLabels] = useState('')
  const [token, setToken] = useState('')
  const [sync, setSync] = useState(false)
  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const opts = (commit: boolean) => ({ repo: repo.trim(), state, labels: labels.trim() || undefined, token: token.trim() || undefined, commit, sync })

  const newCount = data?.imported ?? 0
  const updatedCount = data?.updated ?? 0
  const applyCount = newCount + updatedCount

  const runPreview = async () => {
    if (!repo.trim()) return
    setLoading(true); setError(null); setData(null)
    try {
      const res = await tasksApi.importGithub(projectId, opts(false))
      setData(res.data)
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Could not fetch issues from GitHub.')
    } finally {
      setLoading(false)
    }
  }

  const doCommit = async () => {
    setLoading(true); setError(null)
    try {
      await tasksApi.importGithub(projectId, opts(true))
      onImported(); onClose()
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Import failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Import Tasks from GitHub Issues"
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={doCommit}
            disabled={loading || !data || applyCount === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Upload size={14} className="inline mr-1.5 -mt-0.5" />
            {sync ? 'Sync' : 'Import'} {data ? `${applyCount} task${applyCount === 1 ? '' : 's'}` : ''}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          Pull issues straight from a GitHub repository. Pull requests are skipped; issue <strong>state</strong> maps to task status
          (closed → done) and priority is inferred from labels (<span className="font-mono text-xs">critical/high/low, p1…</span>).
          Public repos need no token; provide a personal access token for private repos or to raise rate limits.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-sm">
            <span className="block text-gray-500 mb-1">Repository</span>
            <input value={repo} onChange={e => setRepo(e.target.value)} placeholder="owner/name or https://github.com/owner/name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="text-sm">
            <span className="block text-gray-500 mb-1">State</span>
            <select value={state} onChange={e => setState(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-gray-500 mb-1">Labels (optional, comma-separated)</span>
            <input value={labels} onChange={e => setLabels(e.target.value)} placeholder="bug,enhancement"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="col-span-2 text-sm">
            <span className="block text-gray-500 mb-1">Access token (optional)</span>
            <input value={token} onChange={e => setToken(e.target.value)} type="password" placeholder="ghp_… — only needed for private repos"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={runPreview} disabled={loading || !repo.trim()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Github size={14} /> {loading ? 'Fetching…' : 'Fetch & preview'}
          </button>
          <label className="inline-flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer" title="Update status, priority and assignee of issues you've already imported, instead of skipping them">
            <input type="checkbox" checked={sync} onChange={e => { setSync(e.target.checked); setData(null) }} className="rounded border-gray-300" />
            Update existing tasks (sync)
          </label>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>

        {data && (
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center gap-4 mb-2 text-sm">
              <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 size={14} /> {newCount} new</span>
              {sync && !!updatedCount && <span className="inline-flex items-center gap-1 text-blue-600"><RefreshCw size={14} /> {updatedCount} to update</span>}
              {!!data.skipped && <span className="inline-flex items-center gap-1 text-amber-600"><CopyMinus size={14} /> {data.skipped} {sync ? 'unchanged' : 'already imported'}</span>}
              {data.errorCount > 0 && <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle size={14} /> {data.errorCount} with errors</span>}
              <span className="text-gray-400">{data.repo} · {data.fetched} fetched · {data.importable} importable (PRs skipped)</span>
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
