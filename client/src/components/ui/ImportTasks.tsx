import { useState, useRef } from 'react'
import { Upload, X, CheckCircle2, AlertCircle, FileText } from 'lucide-react'
import { tasksApi } from '../../api'

interface ParsedTask {
  name: string; status: string; priority: string; estimated_hours: number
  wbs_code?: string; start_date?: string; end_date?: string; sprint?: string; story_points?: number
}

interface Props { projectId: number; onDone: () => void; onCancel: () => void }

function parseCSV(text: string): ParsedTask[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] || '' })

    const priority = ['critical', 'high', 'medium', 'low'].includes(row.priority?.toLowerCase()) ? row.priority.toLowerCase() : 'medium'
    const status = ['todo', 'in_progress', 'review', 'done', 'blocked'].includes(row.status?.toLowerCase()) ? row.status.toLowerCase() : 'todo'
    return {
      name: row.name || row.task || row.task_name || 'Unnamed Task',
      status,
      priority,
      estimated_hours: parseFloat(row.estimated_hours || row.hours || '0') || 0,
      wbs_code: row.wbs_code || row.wbs || undefined,
      start_date: row.start_date || row.start || undefined,
      end_date: row.end_date || row.due_date || row.end || undefined,
      sprint: row.sprint || undefined,
      story_points: parseInt(row.story_points || row.points || '0') || undefined,
    }
  })
}

export default function ImportTasks({ projectId, onDone, onCancel }: Props) {
  const [tasks, setTasks] = useState<ParsedTask[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const parsed = parseCSV(ev.target?.result as string)
        setTasks(parsed)
        setError(parsed.length === 0 ? 'No tasks found — check CSV format' : '')
      } catch {
        setError('Failed to parse CSV')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      for (const t of tasks) {
        await tasksApi.create(projectId, t)
      }
      setDone(true)
      setTimeout(onDone, 1200)
    } catch {
      setError('Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {done ? (
        <div className="text-center py-8">
          <CheckCircle2 size={40} className="mx-auto text-green-500 mb-3" />
          <div className="font-semibold text-gray-900">Imported {tasks.length} tasks!</div>
        </div>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
            <strong>Expected columns:</strong> name, status, priority, estimated_hours, wbs_code, start_date, end_date, sprint, story_points
            <div className="mt-1 text-blue-500">Column names are flexible — name/task/task_name all work, end_date/due_date both work, etc.</div>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <Upload size={24} className="mx-auto text-gray-300 mb-2" />
            <div className="text-sm font-medium text-gray-600">{fileName || 'Click to select CSV file'}</div>
            <div className="text-xs text-gray-400 mt-1">CSV files only</div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {tasks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText size={14} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700">{tasks.length} tasks ready to import</span>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Name', 'Status', 'Priority', 'Hours', 'Sprint'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 px-3 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tasks.slice(0, 10).map((t, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-xs text-gray-800 max-w-[140px] truncate">{t.name}</td>
                        <td className="px-3 py-1.5 text-xs text-gray-500">{t.status}</td>
                        <td className="px-3 py-1.5 text-xs text-gray-500">{t.priority}</td>
                        <td className="px-3 py-1.5 text-xs text-gray-500">{t.estimated_hours || '—'}</td>
                        <td className="px-3 py-1.5 text-xs text-gray-500 truncate">{t.sprint || '—'}</td>
                      </tr>
                    ))}
                    {tasks.length > 10 && <tr><td colSpan={5} className="px-3 py-1.5 text-xs text-gray-400 italic">…and {tasks.length - 10} more</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
            <button onClick={handleImport} disabled={tasks.length === 0 || importing} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40">
              {importing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload size={14} />}
              Import {tasks.length > 0 ? `${tasks.length} Tasks` : ''}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
