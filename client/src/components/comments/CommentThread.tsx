import { useState, useEffect } from 'react'
import { MessageCircle, Send, Trash2 } from 'lucide-react'
import { commentsApi } from '../../api'
import { Comment } from '../../types'
import { formatDistanceToNow, parseISO } from 'date-fns'
import Avatar from '../ui/Avatar'
import { useAuthStore } from '../../store'

interface Props {
  entityType: string
  entityId: number
}

export default function CommentThread({ entityType, entityId }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const user = useAuthStore(s => s.user)

  useEffect(() => {
    setLoading(true)
    commentsApi.list(entityType, entityId)
      .then(r => setComments(r.data.comments || []))
      .finally(() => setLoading(false))
  }, [entityType, entityId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await commentsApi.create(entityType, entityId, text.trim())
      setComments(prev => [...prev, res.data.comment])
      setText('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    await commentsApi.delete(id)
    setComments(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
        <MessageCircle size={15} className="text-gray-400" />
        Comments ({comments.length})
      </h4>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">No comments yet. Be the first to comment.</p>
      ) : (
        <div className="space-y-3">
          {comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <Avatar name={c.user_name} size="sm" className="flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700">{c.user_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(parseISO(c.created_at), { addSuffix: true })}
                      </span>
                      {(user?.id === c.user_id || user?.role === 'admin') && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                          title="Delete comment"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Avatar name={user?.name || 'U'} size="sm" className="flex-shrink-0 mt-1" />
        <div className="flex-1 flex gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 text-sm px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent) } }}
          />
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  )
}
