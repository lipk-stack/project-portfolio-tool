import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore } from '../../store'

const ICONS = {
  success: <CheckCircle size={16} className="text-green-500 flex-shrink-0" />,
  error: <XCircle size={16} className="text-red-500 flex-shrink-0" />,
  warning: <AlertTriangle size={16} className="text-yellow-500 flex-shrink-0" />,
  info: <Info size={16} className="text-blue-500 flex-shrink-0" />,
}

const BG = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  warning: 'bg-yellow-50 border-yellow-200',
  info: 'bg-blue-50 border-blue-200',
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore()
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg animate-slide-up ${BG[t.type]}`}>
          {ICONS[t.type]}
          <span className="text-sm text-gray-800 flex-1">{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function useToast() {
  const addToast = useToastStore(s => s.addToast)
  return {
    success: (msg: string) => addToast(msg, 'success'),
    error: (msg: string) => addToast(msg, 'error'),
    warning: (msg: string) => addToast(msg, 'warning'),
    info: (msg: string) => addToast(msg, 'info'),
  }
}
