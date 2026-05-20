import { useForm } from 'react-hook-form'
import { Risk } from '../../types'

interface Props {
  risk?: Risk
  members?: Array<{ id: number; name: string }>
  onSubmit: (data: Partial<Risk>) => void
  onCancel: () => void
  loading?: boolean
}

export default function RiskForm({ risk, members = [], onSubmit, onCancel, loading }: Props) {
  const { register, handleSubmit } = useForm<Partial<Risk>>({
    defaultValues: risk || {
      probability: 'medium', impact: 'medium', category: 'technical',
      status: 'open', response: 'mitigate',
      identified_date: new Date().toISOString().split('T')[0],
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Risk Title *</label>
        <input {...register('title', { required: true })} placeholder="Describe the risk..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea {...register('description')} rows={2} placeholder="Provide more details..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select {...register('category')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            {['technical', 'schedule', 'budget', 'resource', 'external', 'compliance', 'general'].map(c =>
              <option key={c} value={c} className="capitalize">{c}</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select {...register('status')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="open">Open</option>
            <option value="mitigating">Mitigating</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Probability</label>
          <select {...register('probability')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Impact</label>
          <select {...register('impact')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Response Strategy</label>
          <select {...register('response')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="mitigate">Mitigate</option>
            <option value="avoid">Avoid</option>
            <option value="transfer">Transfer</option>
            <option value="accept">Accept</option>
          </select>
        </div>
        {members.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
            <select {...register('owner_id')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Unassigned</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mitigation Plan</label>
        <textarea {...register('mitigation_plan')} rows={2} placeholder="How will this risk be mitigated?"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Identified Date</label>
          <input type="date" {...register('identified_date')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Target Date</label>
          <input type="date" {...register('target_date')} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Saving...' : risk ? 'Update Risk' : 'Add Risk'}
        </button>
      </div>
    </form>
  )
}
