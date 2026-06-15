import { useEffect, useState, useCallback } from 'react'
import { Paperclip, Download, Trash2, Upload } from 'lucide-react'
import { attachmentsApi, exportApi } from '../api'
import { Attachment } from '../types'

const MAX_BYTES = 10 * 1024 * 1024

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

interface Props { taskId: number }

export default function AttachmentsPanel({ taskId }: Props) {
  const [items, setItems] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    attachmentsApi.list(taskId).then(r => setItems(r.data.attachments)).catch(() => {})
  }, [taskId])

  useEffect(() => { load() }, [load])

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setError(null)
    if (file.size > MAX_BYTES) { setError(`"${file.name}" exceeds the 10 MB limit`); return }
    const reader = new FileReader()
    reader.onload = async () => {
      setBusy(true)
      try {
        // readAsDataURL gives `data:<mime>;base64,<payload>` — the server accepts it directly.
        await attachmentsApi.upload(taskId, {
          filename: file.name,
          mime: file.type || 'application/octet-stream',
          data: String(reader.result || ''),
        })
        load()
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
        setError(msg || 'Upload failed')
      } finally { setBusy(false) }
    }
    reader.onerror = () => setError('Could not read the file')
    reader.readAsDataURL(file)
  }

  const download = (a: Attachment) => exportApi.downloadWithAuth(attachmentsApi.downloadUrl(a.id), a.filename)

  const remove = async (a: Attachment) => {
    if (!confirm(`Delete "${a.filename}"?`)) return
    await attachmentsApi.delete(a.id)
    setItems(prev => prev.filter(x => x.id !== a.id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <Paperclip size={14} className="text-gray-400" /> Attachments {items.length > 0 && <span className="text-gray-400 font-normal">({items.length})</span>}
        </div>
        <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload size={12} /> {busy ? 'Uploading…' : 'Add file'}
          <input type="file" onChange={onFile} className="hidden" disabled={busy} />
        </label>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {items.length === 0 ? (
        <p className="text-xs text-gray-400">No files attached yet. Up to 10 MB per file.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map(a => (
            <li key={a.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-1.5">
              <Paperclip size={13} className="text-gray-400 flex-shrink-0" />
              <button onClick={() => download(a)} className="flex-1 min-w-0 text-left text-blue-600 hover:underline truncate" title={a.filename}>
                {a.filename}
              </button>
              <span className="text-xs text-gray-400 flex-shrink-0">{formatBytes(a.size)}</span>
              <button onClick={() => download(a)} className="p-1 text-gray-400 hover:text-blue-600" aria-label="Download"><Download size={13} /></button>
              <button onClick={() => remove(a)} className="p-1 text-gray-400 hover:text-red-500" aria-label="Delete"><Trash2 size={13} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
