import { useEffect, useState } from 'react'
import { Inbox, CheckCircle, XCircle, Clock, Eye, X, ExternalLink } from 'lucide-react'
import api from '../api'
import { format, parseISO } from 'date-fns'
import Modal from '../components/ui/Modal'

interface ProjectRequest {
  id: number
  title: string
  description: string | null
  requester_name: string
  requester_email: string
  business_case: string | null
  estimated_budget: number | null
  estimated_duration: string | null
  priority: string
  department: string | null
  status: string
  reviewer_name: string | null
  reviewer_notes: string | null
  project_id: number | null
  project_name: string | null
  created_at: string
  reviewed_at: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending Review', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-100' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-100' },
  deferred: { label: 'Deferred', color: 'text-gray-700', bg: 'bg-gray-100' },
  converted: { label: 'Converted to Project', color: 'text-blue-700', bg: 'bg-blue-100' },
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-600 bg-red-50', high: 'text-orange-600 bg-orange-50',
  medium: 'text-yellow-600 bg-yellow-50', low: 'text-gray-600 bg-gray-50',
}

export default function ProjectRequests() {
  const [requests, setRequests] = useState<ProjectRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReq, setSelectedReq] = useState<ProjectRequest | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [filter, setFilter] = useState('pending')

  const load = () => {
    api.get('/requests').then(r => setRequests(r.data.requests)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleReview = async (status: string) => {
    if (!selectedReq) return
    setReviewing(true)
    try {
      await api.put(`/requests/${selectedReq.id}`, { status, reviewer_notes: reviewNotes })
      setSelectedReq(null)
      setReviewNotes('')
      load()
    } finally { setReviewing(false) }
  }

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Inbox size={24} className="text-blue-600" />
            Project Requests
            {pendingCount > 0 && (
              <span className="text-xs px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium">{pendingCount} pending</span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Review and action incoming project requests from stakeholders</p>
        </div>
        <a href="/request-project" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50 transition-colors">
          <ExternalLink size={14} /> View Request Form
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
          <button
            key={status}
            onClick={() => setFilter(status === filter ? 'all' : status)}
            className={`bg-white rounded-xl border p-4 text-left transition-shadow hover:shadow-md ${filter === status ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'}`}
          >
            <div className="text-2xl font-bold text-gray-900">{requests.filter(r => r.status === status).length}</div>
            <div className={`text-xs font-medium mt-0.5 px-1.5 py-0.5 rounded inline-block ${cfg.bg} ${cfg.color}`}>{cfg.label}</div>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[['all', 'All'], ...Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${filter === k ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Inbox size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No {filter === 'all' ? '' : filter} requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending
            return (
              <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_COLOR[req.priority] || PRIORITY_COLOR.medium}`}>{req.priority}</span>
                      {req.department && <span className="text-xs text-gray-400">• {req.department}</span>}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-base">{req.title}</h3>
                    {req.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{req.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>From: <span className="font-medium text-gray-600">{req.requester_name}</span> ({req.requester_email})</span>
                      {req.estimated_budget && <span>Budget: ${req.estimated_budget.toLocaleString()}</span>}
                      {req.estimated_duration && <span>Duration: {req.estimated_duration}</span>}
                      <span>Submitted {format(parseISO(req.created_at), 'MMM d, yyyy')}</span>
                    </div>
                    {req.reviewer_notes && (
                      <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                        <span className="font-medium">Review note:</span> {req.reviewer_notes}
                      </div>
                    )}
                    {req.project_name && (
                      <div className="mt-1 text-xs text-blue-600">→ Project: {req.project_name}</div>
                    )}
                  </div>
                  <button
                    onClick={() => { setSelectedReq(req); setReviewNotes(req.reviewer_notes || '') }}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 flex-shrink-0 transition-colors"
                  >
                    <Eye size={14} /> Review
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Review modal */}
      <Modal isOpen={!!selectedReq} onClose={() => setSelectedReq(null)} title="Review Project Request" size="md">
        {selectedReq && (
          <div className="space-y-5">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Request Title</div>
                <div className="font-semibold text-gray-900">{selectedReq.title}</div>
              </div>
              {selectedReq.description && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</div>
                  <div className="text-sm text-gray-700">{selectedReq.description}</div>
                </div>
              )}
              {selectedReq.business_case && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Business Case</div>
                  <div className="text-sm text-gray-700">{selectedReq.business_case}</div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-200">
                <div><div className="text-xs text-gray-400">From</div><div className="text-sm font-medium">{selectedReq.requester_name}</div></div>
                {selectedReq.estimated_budget && <div><div className="text-xs text-gray-400">Budget</div><div className="text-sm font-medium">${selectedReq.estimated_budget.toLocaleString()}</div></div>}
                {selectedReq.estimated_duration && <div><div className="text-xs text-gray-400">Duration</div><div className="text-sm font-medium">{selectedReq.estimated_duration}</div></div>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Review Notes</label>
              <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={3} className="input-field resize-none w-full" placeholder="Add your review notes, feedback, or conditions..." />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => handleReview('approved')} disabled={reviewing} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                <CheckCircle size={14} /> Approve
              </button>
              <button onClick={() => handleReview('rejected')} disabled={reviewing} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50">
                <XCircle size={14} /> Reject
              </button>
              <button onClick={() => handleReview('deferred')} disabled={reviewing} className="flex items-center gap-1.5 px-4 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 disabled:opacity-50">
                <Clock size={14} /> Defer
              </button>
              <button onClick={() => setSelectedReq(null)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50 ml-auto">
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
