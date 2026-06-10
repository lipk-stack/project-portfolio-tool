import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Type, Hash, List as ListIcon, Calendar } from 'lucide-react'
import { customFieldsApi } from '../api'
import { CustomField } from '../types'

const TYPE_ICONS = { text: Type, number: Hash, select: ListIcon, date: Calendar }

export default function CustomFieldsManager({ projectId, onChanged }: { projectId: number; onChanged?: () => void }) {
  const [fields, setFields] = useState<CustomField[]>([])
  const [name, setName] = useState('')
  const [fieldType, setFieldType] = useState<CustomField['field_type']>('text')
  const [optionsText, setOptionsText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    customFieldsApi.list(projectId).then(r => setFields(r.data.fields)).catch(() => {})
  }, [projectId])

  useEffect(() => { load() }, [load])

  const addField = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      const options = fieldType === 'select'
        ? optionsText.split(',').map(s => s.trim()).filter(Boolean)
        : undefined
      await customFieldsApi.create(projectId, { name: name.trim(), field_type: fieldType, options })
      setName('')
      setOptionsText('')
      load()
      onChanged?.()
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } }
      setError(err.response?.data?.error || 'Failed to create field')
    } finally { setSaving(false) }
  }

  const deleteField = async (id: number) => {
    if (!confirm('Delete this field? All its task values will be removed.')) return
    await customFieldsApi.delete(id)
    load()
    onChanged?.()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Custom fields appear on every task in this project.</p>

      <div className="space-y-2">
        {fields.map(f => {
          const Icon = TYPE_ICONS[f.field_type] || Type
          return (
            <div key={f.id} className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2">
              <Icon size={14} className="text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800">{f.name}</span>
                <span className="text-xs text-gray-400 ml-2 capitalize">{f.field_type}</span>
                {f.options && <span className="text-xs text-gray-400 ml-2 truncate">({f.options.join(', ')})</span>}
              </div>
              <button onClick={() => deleteField(f.id)} className="p-1 text-gray-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}
        {fields.length === 0 && <div className="text-sm text-gray-400 text-center py-4">No custom fields yet</div>}
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Field name"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={fieldType}
            onChange={e => setFieldType(e.target.value as CustomField['field_type'])}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="select">Select</option>
            <option value="date">Date</option>
          </select>
        </div>
        {fieldType === 'select' && (
          <input
            value={optionsText}
            onChange={e => setOptionsText(e.target.value)}
            placeholder="Options, comma-separated (e.g. Dev, Staging, Production)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <button
          onClick={addField}
          disabled={saving || !name.trim()}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={14} /> Add Field
        </button>
      </div>
    </div>
  )
}
