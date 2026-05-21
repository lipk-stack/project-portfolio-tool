import { useState } from 'react'
import { Send, CheckCircle, Zap } from 'lucide-react'
import api from '../api'

export default function RequestProject() {
  const [form, setForm] = useState({
    title: '', description: '', requester_name: '', requester_email: '',
    business_case: '', estimated_budget: '', estimated_duration: '', priority: 'medium', department: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.title.trim() || !form.requester_name.trim() || !form.requester_email.trim()) {
      setError('Please fill in all required fields.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/requests', {
        ...form,
        estimated_budget: form.estimated_budget ? parseFloat(form.estimated_budget) : null,
      })
      setSubmitted(true)
    } catch {
      setError('Failed to submit request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted!</h2>
          <p className="text-gray-500 mb-6">Your project request has been received and will be reviewed by our project management team.</p>
          <button onClick={() => { setSubmitted(false); setForm({ title: '', description: '', requester_name: '', requester_email: '', business_case: '', estimated_budget: '', estimated_duration: '', priority: 'medium', department: '' }) }} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Submit Another Request
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl px-8 py-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Zap size={16} />
            </div>
            <span className="font-semibold">ProjectPulse</span>
          </div>
          <h1 className="text-2xl font-bold">Submit a Project Request</h1>
          <p className="text-blue-200 mt-1 text-sm">Fill in the form below and our PM team will review your request within 2 business days.</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your Name *</label>
              <input value={form.requester_name} onChange={e => set('requester_name', e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Jane Smith" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your Email *</label>
              <input type="email" value={form.requester_email} onChange={e => set('requester_email', e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="jane@company.com" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Project Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Customer Self-Service Portal" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Project Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="What does this project aim to achieve?" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Business Case / Justification</label>
            <textarea value={form.business_case} onChange={e => set('business_case', e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Why is this project important? What business value will it deliver?" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Est. Budget ($)</label>
              <input type="number" value={form.estimated_budget} onChange={e => set('estimated_budget', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="50000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Est. Duration</label>
              <input value={form.estimated_duration} onChange={e => set('estimated_duration', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="3-6 months" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Department</label>
            <input value={form.department} onChange={e => set('department', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Marketing, IT, Finance..." />
          </div>

          <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors mt-2">
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {submitting ? 'Submitting…' : 'Submit Project Request'}
          </button>
        </form>
      </div>
    </div>
  )
}
