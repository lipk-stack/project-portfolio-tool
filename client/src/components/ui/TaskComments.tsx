import { useState, useEffect, useRef } from 'react'
import { commentsApi } from '../../api'
import { useAuthStore } from '../../store'
import Avatar from './Avatar'
import { Send, Trash2 } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'

interface Comment {
  id: number
  content: string
  user_id: number
  user_name: string
  user_email: string
  created_at: string
}

export default function TaskComments({ taskId }: { taskId: number }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const currentUser = useAuthStore(s => s.user)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    commentsApi.listForTask(taskId)
      .then(r => setComments(r.data.comments))
      .finally(() => setLoading(false))
  }, [taskId])

  const submit = async () => {
    if (!content.trim()) return
    setSaving(true)
    try {
      const r = await commentsApi.createForTask(taskId, content)
      setComments(prev => [...prev, r.data.comment])
      setContent('')
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    await commentsApi.delete(id)
    setComments(prev => prev.filter(c => c.id !== id))
  }

  if (loading) return <div className="text-sm text-gray-400 py-4 text-center">Loading comments...</div>

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {comments.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-4">No comments yet. Start the conversation.</div>
        )}
        {comments.map(c => (
          <div key={c.id} className="flex gap-3 group">
            <Avatar name={c.user_name} size="xs" className="mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-800">{c.user_name}</span>
                <span className="text-xs text-gray-400">{formatDistanceToNow(parseISO(c.created_at), { addSuffix: true })}</span>
              </div>
              <div className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">{c.content}</div>
            </div>
            {currentUser?.id === c.user_id && (
              <button
                onClick={() => remove(c.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-red-500 flex-shrink-0"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <Avatar name={currentUser?.name || 'U'} size="xs" className="mt-1 flex-shrink-0" />
        <div className="flex-1 flex gap-2">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
            placeholder="Add a comment... (Ctrl+Enter to submit)"
            rows={2}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <button
            onClick={submit}
            disabled={!content.trim() || saving}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm font-medium flex-shrink-0 self-end"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
