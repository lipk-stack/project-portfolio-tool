import { useState, useEffect, useRef } from 'react'
import api from '../../api'
import Avatar from './Avatar'
import { Send, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuthStore } from '../../store'

interface Comment {
  id: number; content: string; author_name: string; user_id: number; created_at: string
}

interface Props {
  entityType: 'project' | 'task'
  entityId: number
}

export default function CommentThread({ entityType, entityId }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const user = useAuthStore(s => s.user)
  const endRef = useRef<HTMLDivElement>(null)

  const load = () => {
    api.get(`/${entityType === 'task' ? 'tasks' : 'projects'}/${entityId}/comments`)
      .then(r => setComments(r.data.comments))
  }

  useEffect(() => { load() }, [entityId])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [comments.length])

  const post = async () => {
    if (!text.trim()) return
    setPosting(true)
    try {
      await api.post(`/${entityType === 'task' ? 'tasks' : 'projects'}/${entityId}/comments`, { content: text })
      setText('')
      load()
    } finally { setPosting(false) }
  }

  const del = async (id: number) => {
    await api.delete(`/${entityType === 'task' ? 'tasks' : 'projects'}/${entityId}/comments/${id}`)
    load()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {comments.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No comments yet</p>}
        {comments.map(c => (
          <div key={c.id} className="flex items-start gap-3 group">
            <Avatar name={c.author_name} size="xs" className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-gray-800">{c.author_name}</span>
                <span className="text-xs text-gray-400">{format(parseISO(c.created_at), 'MMM d, HH:mm')}</span>
              </div>
              <div className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">{c.content}</div>
            </div>
            {user?.id === c.user_id && (
              <button onClick={() => del(c.id)} className="p-1 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 mt-1">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        {user && <Avatar name={user.name} size="xs" className="flex-shrink-0" />}
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post() } }}
          placeholder="Add a comment…"
          className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={post} disabled={!text.trim() || posting} className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0">
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
