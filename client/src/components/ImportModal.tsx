import { useState, ReactNode } from 'react'
import { Upload, FileText, AlertTriangle, CheckCircle2, Download } from 'lucide-react'
import Modal from './ui/Modal'
import { exportApi } from '../api'

export interface PreviewRow { row: number; errors: string[]; [k: string]: unknown }
export interface PreviewData {
  headers: string[]
  unmappedHeaders: string[]
  validCount: number
  errorCount: number
  rows: PreviewRow[]
}

export interface ImportColumn {
  label: string
  render: (row: PreviewRow) => ReactNode
}

interface Props {
  title: string
  noun: string // singular, e.g. "task" / "risk"
  description: ReactNode
  sample: string
  templateUrl: string
  templateName: string
  columns: ImportColumn[]
  preview: (csv: string) => Promise<{ data: PreviewData }>
  commit: (csv: string) => Promise<unknown>
  onClose: () => void
  onImported: () => void
}

// Config-driven CSV import dialog shared by the task and risk importers: upload
// or paste a CSV, see a validated dry-run preview, then commit only valid rows.
export default function ImportModal({ title, noun, description, sample, templateUrl, templateName, columns, preview, commit, onClose, onImported }: Props) {
  const [csv, setCsv] = useState('')
  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runPreview = async (text: string) => {
    setError(null)
    if (!text.trim()) { setData(null); return }
    setLoading(true)
    try {
      const res = await preview(text)
      setData(res.data)
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

  const doCommit = async () => {
    setLoading(true)
    setError(null)
    try {
      await commit(csv)
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
      title={title}
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={doCommit}
            disabled={loading || !data || data.validCount === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Upload size={14} className="inline mr-1.5 -mt-0.5" />
            Import {data ? `${data.validCount} valid ${noun}${data.validCount === 1 ? '' : 's'}` : ''}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-600">{description}</div>

        <div className="flex items-center gap-3 flex-wrap">
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer">
            <FileText size={14} /> Choose .csv file
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          </label>
          <button onClick={() => { setCsv(sample); runPreview(sample) }} className="text-sm text-blue-600 hover:underline">Use sample data</button>
          <button onClick={() => exportApi.downloadWithAuth(templateUrl, templateName)} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <Download size={13} /> Download template
          </button>
        </div>

        <textarea
          value={csv}
          onChange={e => setCsv(e.target.value)}
          onBlur={() => runPreview(csv)}
          rows={6}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
        <div className="flex items-center gap-3">
          <button onClick={() => runPreview(csv)} disabled={loading || !csv.trim()} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {loading ? 'Parsing…' : 'Preview'}
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>

        {data && (
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center gap-4 mb-2 text-sm">
              <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 size={14} /> {data.validCount} valid</span>
              {data.errorCount > 0 && <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle size={14} /> {data.errorCount} with errors</span>}
              {data.unmappedHeaders.length > 0 && <span className="text-gray-400">Ignored columns: {data.unmappedHeaders.join(', ')}</span>}
            </div>
            <div className="max-h-64 overflow-auto border border-gray-100 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-gray-500">
                    <th className="px-2 py-1.5">#</th>
                    {columns.map(c => <th key={c.label} className="px-2 py-1.5">{c.label}</th>)}
                    <th className="px-2 py-1.5">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(r => (
                    <tr key={r.row} className={`border-t border-gray-100 ${r.errors.length ? 'bg-red-50' : ''}`}>
                      <td className="px-2 py-1.5 text-gray-400">{r.row}</td>
                      {columns.map(c => <td key={c.label} className="px-2 py-1.5">{c.render(r)}</td>)}
                      <td className="px-2 py-1.5 text-red-600">{r.errors.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.errorCount > 0 && <p className="text-xs text-gray-400 mt-2">Rows with errors are skipped; only valid rows are imported.</p>}
          </div>
        )}
      </div>
    </Modal>
  )
}
