import { useState } from 'react'
import { Upload, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Modal from './ui/Modal'
import { tasksApi } from '../api'

interface ParsedRow {
  row: number
  name: string
  status: string
  priority: string
  assignee: string | null
  start_date: string | null
  end_date: string | null
  estimated_hours: number
  errors: string[]
}

interface Preview {
  headers: string[]
  unmappedHeaders: string[]
  validCount: number
  errorCount: number
  rows: ParsedRow[]
}

const SAMPLE = `name,assignee,start_date,end_date,priority,estimated_hours,status
Kickoff workshop,john.manager@demo.com,2026-07-01,2026-07-02,high,8,todo
Draft requirements,Alex Rivera,2026-07-03,2026-07-10,medium,24,in_progress
Vendor evaluation,,2026-07-05,2026-07-20,low,16,todo`

interface Props {
  projectId: number
  onClose: () => void
  onImported: () => void
}

export default function ImportTasksModal({ projectId, onClose, onImported }: Props) {
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runPreview = async (text: string) => {
    setError(null)
    if (!text.trim()) { setPreview(null); return }
    setLoading(true)
    try {
      const res = await tasksApi.importCsv(projectId, text, false)
      setPreview(res.data)
    } catch {
      setError('Could not parse the CSV. Check the format and try again.')
    } finally {
      setLoading(false)
    }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      setCsv(text)
      runPreview(text)
    }
    reader.readAsText(file)
  }

  const commit = async () => {
    setLoading(true)
    setError(null)
    try {
      await tasksApi.importCsv(projectId, csv, true)
      onImported()
      onClose()
    } catch {
      setError('Import failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Import Tasks from CSV"
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={commit}
            disabled={loading || !preview || preview.validCount === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Upload size={14} className="inline mr-1.5 -mt-0.5" />
            Import {preview ? `${preview.validCount} valid task${preview.validCount === 1 ? '' : 's'}` : ''}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Paste or upload a CSV exported from Excel, MS Project, Jira, or Asana. Recognized columns:
          <span className="font-mono text-xs"> name, description, status, priority, assignee, start_date, end_date, estimated_hours, story_points, wbs_code</span>.
          Common header aliases (Task Name, Owner, Due Date, Points…) are mapped automatically. Only <strong>name</strong> is required.
        </p>

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer">
            <FileText size={14} /> Choose .csv file
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          </label>
          <button onClick={() => { setCsv(SAMPLE); runPreview(SAMPLE) }} className="text-sm text-blue-600 hover:underline">Use sample data</button>
        </div>

        <textarea
          value={csv}
          onChange={e => setCsv(e.target.value)}
          onBlur={() => runPreview(csv)}
          rows={6}
          placeholder="name,assignee,end_date,priority&#10;Design API,Alex Rivera,2026-08-01,high"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
        <div className="flex items-center gap-3">
          <button onClick={() => runPreview(csv)} disabled={loading || !csv.trim()} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {loading ? 'Parsing…' : 'Preview'}
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>

        {preview && (
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center gap-4 mb-2 text-sm">
              <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 size={14} /> {preview.validCount} valid</span>
              {preview.errorCount > 0 && <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle size={14} /> {preview.errorCount} with errors</span>}
              {preview.unmappedHeaders.length > 0 && <span className="text-gray-400">Ignored columns: {preview.unmappedHeaders.join(', ')}</span>}
            </div>
            <div className="max-h-64 overflow-auto border border-gray-100 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-gray-500">
                    <th className="px-2 py-1.5">#</th>
                    <th className="px-2 py-1.5">Name</th>
                    <th className="px-2 py-1.5">Status</th>
                    <th className="px-2 py-1.5">Priority</th>
                    <th className="px-2 py-1.5">Assignee</th>
                    <th className="px-2 py-1.5">Dates</th>
                    <th className="px-2 py-1.5">Hrs</th>
                    <th className="px-2 py-1.5">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map(r => (
                    <tr key={r.row} className={`border-t border-gray-100 ${r.errors.length ? 'bg-red-50' : ''}`}>
                      <td className="px-2 py-1.5 text-gray-400">{r.row}</td>
                      <td className="px-2 py-1.5 font-medium text-gray-800">{r.name || <span className="text-red-500 italic">(missing)</span>}</td>
                      <td className="px-2 py-1.5">{r.status}</td>
                      <td className="px-2 py-1.5">{r.priority}</td>
                      <td className="px-2 py-1.5">{r.assignee || '—'}</td>
                      <td className="px-2 py-1.5 text-gray-500">{r.start_date || '…'} → {r.end_date || '…'}</td>
                      <td className="px-2 py-1.5">{r.estimated_hours || ''}</td>
                      <td className="px-2 py-1.5 text-red-600">{r.errors.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.errorCount > 0 && <p className="text-xs text-gray-400 mt-2">Rows with errors are skipped; only valid rows are imported.</p>}
          </div>
        )}
      </div>
    </Modal>
  )
}
