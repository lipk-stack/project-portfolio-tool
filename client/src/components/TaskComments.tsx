import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Send, Loader2 } from 'lucide-react'
import { tasksApi } from '../api'
import { useAuthStore } from '../store'
import Avatar from './ui/Avatar'
import { formatDistanceToNow, parseISO } from 'date-fns'

interface Comment {
  id: number
  user_id: number
  user_name: string
  user_email: string
  content: string
  created_at: string
}

export default function TaskComments({ taskId }: { taskId: number }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [text, setText] = useState('')
  const user = useAuthStore(s => s.user)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    tasksApi.getComments(taskId)
      .then(r => setComments(r.data.comments))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [taskId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  const handleSend = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const res = await tasksApi.addComment(taskId, text.trim())
      setComments(prev => [...prev, res.data.comment])
      setText('')
    } catch {
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 pt-2 border-t border-gray-100">
        <MessageSquare size={14} className="text-gray-400" />
        Comments {comments.length > 0 && <span className="text-xs font-normal text-gray-400">({comments.length})</span>}
      </div>

      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 size={16} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-3 max-h-48 overflow-y-auto">
          {comments.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No comments yet. Be the first to comment.</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="flex gap-2.5">
                <Avatar name={c.user_name} size="xs" className="flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-700">{c.user_name}</span>
                    <span className="text-xs text-gray-400">{formatDistanceToNow(parseISO(c.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap break-words">{c.content}</p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="flex gap-2 items-end">
        <Avatar name={user?.name || 'U'} size="xs" className="flex-shrink-0 mb-0.5" />
        <div className="flex-1 relative">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Add a comment... (Ctrl+Enter to send)"
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 pr-9 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="absolute right-2 bottom-2 p-1 text-blue-600 hover:text-blue-700 disabled:text-gray-300 transition-colors"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}
