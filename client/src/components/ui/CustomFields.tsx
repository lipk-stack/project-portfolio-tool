import { useEffect, useState } from 'react'
import api from '../../api'
import { Plus, X, Settings2 } from 'lucide-react'

interface FieldDef { id: number; name: string; field_type: string; options: string | null }
interface FieldValue { field_id: number; entity_id: number; name: string; field_type: string; options: string | null; value: string | null }

interface Props { entityType: string; entityId: number }

export default function CustomFields({ entityType, entityId }: Props) {
  const [defs, setDefs] = useState<FieldDef[]>([])
  const [values, setValues] = useState<FieldValue[]>([])
  const [addingField, setAddingField] = useState(false)
  const [newField, setNewField] = useState({ name: '', field_type: 'text', options: '' })
  const [saving, setSaving] = useState<number | null>(null)

  const load = () => {
    Promise.all([
      api.get(`/custom-fields/definitions/${entityType}`),
      api.get(`/custom-fields/values/${entityType}/${entityId}`),
    ]).then(([dr, vr]) => {
      setDefs(dr.data.definitions)
      setValues(vr.data.values)
    })
  }

  useEffect(() => { load() }, [entityId])

  const getVal = (fieldId: number) => values.find(v => v.field_id === fieldId)?.value ?? ''

  const updateVal = async (fieldId: number, value: string) => {
    setSaving(fieldId)
    await api.put(`/custom-fields/values/${fieldId}/${entityId}`, { value })
    load()
    setSaving(null)
  }

  const addDef = async () => {
    if (!newField.name.trim()) return
    const options = newField.field_type === 'select' && newField.options
      ? newField.options.split(',').map(o => o.trim()).filter(Boolean)
      : undefined
    await api.post('/custom-fields/definitions', { entity_type: entityType, name: newField.name, field_type: newField.field_type, options })
    setNewField({ name: '', field_type: 'text', options: '' })
    setAddingField(false)
    load()
  }

  const deleteDef = async (id: number) => {
    await api.delete(`/custom-fields/definitions/${id}`)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <Settings2 size={14} className="text-gray-400" /> Custom Fields
        </div>
        <button onClick={() => setAddingField(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
          <Plus size={12} /> Add field
        </button>
      </div>

      {addingField && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
          <input value={newField.name} onChange={e => setNewField(f => ({ ...f, name: e.target.value }))} className="input-field text-sm" placeholder="Field name" />
          <select value={newField.field_type} onChange={e => setNewField(f => ({ ...f, field_type: e.target.value }))} className="input-field text-sm">
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="select">Select (dropdown)</option>
            <option value="boolean">Yes/No checkbox</option>
            <option value="url">URL</option>
          </select>
          {newField.field_type === 'select' && (
            <input value={newField.options} onChange={e => setNewField(f => ({ ...f, options: e.target.value }))} className="input-field text-sm" placeholder="Options comma-separated (e.g. Low,Medium,High)" />
          )}
          <div className="flex gap-2">
            <button onClick={addDef} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">Add</button>
            <button onClick={() => setAddingField(false)} className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {defs.length === 0 && !addingField && (
        <p className="text-xs text-gray-400 italic">No custom fields yet</p>
      )}

      <div className="space-y-2">
        {defs.map(def => {
          const val = getVal(def.id)
          const opts = def.options ? JSON.parse(def.options) : []
          return (
            <div key={def.id} className="flex items-center gap-2 group">
              <div className="w-28 text-xs font-medium text-gray-500 truncate flex-shrink-0">{def.name}</div>
              <div className="flex-1">
                {def.field_type === 'select' ? (
                  <select value={val} onChange={e => updateVal(def.id, e.target.value)} className="input-field text-xs py-1">
                    <option value="">—</option>
                    {opts.map((o: string) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : def.field_type === 'boolean' ? (
                  <input type="checkbox" checked={val === 'true'} onChange={e => updateVal(def.id, e.target.checked ? 'true' : 'false')} className="w-4 h-4 rounded" />
                ) : (
                  <input
                    type={def.field_type === 'number' ? 'number' : def.field_type === 'date' ? 'date' : def.field_type === 'url' ? 'url' : 'text'}
                    value={val}
                    onChange={e => updateVal(def.id, e.target.value)}
                    className="input-field text-xs py-1"
                    placeholder={`Enter ${def.name.toLowerCase()}…`}
                  />
                )}
              </div>
              {saving === def.id && <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
              <button onClick={() => deleteDef(def.id)} className="p-0.5 text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
