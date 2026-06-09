import { useEffect, useState } from 'react'
import { Send, Trash2, MessageSquare } from 'lucide-react'
import { commentsApi } from '../api'
import { Comment } from '../types'
import { formatDistanceToNow, parseISO } from 'date-fns'
import Avatar from './ui/Avatar'
import { useAuthStore } from '../store'

export default function CommentsPanel({ entityType, entityId }: { entityType: string; entityId: number }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const user = useAuthStore(s => s.user)

  const load = async () => {
    setLoading(true)
    try {
      const res = await commentsApi.list(entityType, entityId)
      setComments(res.data.comments)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [entityType, entityId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setPosting(true)
    try {
      const res = await commentsApi.add(entityType, entityId, content)
      setComments(prev => [...prev, res.data.comment])
      setContent('')
    } finally { setPosting(false) }
  }

  const remove = async (id: number) => {
    if (!confirm('Delete this comment?')) return
    await commentsApi.delete(id)
    setComments(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
        <MessageSquare size={14} className="text-gray-400" /> Comments ({comments.length})
      </h4>

      {loading ? (
        <div className="text-center text-gray-400 text-xs py-4">Loading...</div>
      ) : comments.length === 0 ? (
        <div className="text-center text-gray-400 text-xs py-4">No comments yet. Start the conversation.</div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-2">
              <Avatar name={c.user_name} size="xs" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-800">{c.user_name}</span>
                  <span className="text-[10px] text-gray-400">{formatDistanceToNow(parseISO(c.created_at), { addSuffix: true })}</span>
                  {user?.id === c.user_id && (
                    <button onClick={() => remove(c.id)} className="ml-auto text-gray-300 hover:text-red-500">
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">{c.content}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <input
          type="text"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" disabled={posting || !content.trim()} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
