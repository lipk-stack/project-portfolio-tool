import { useState, useEffect, useRef } from 'react'
import { Play, Square, Clock, ChevronDown } from 'lucide-react'
import { tasksApi } from '../api'

interface TimeTrackerProps {
  taskId: number
  taskName: string
  projectId: number
  onTimeLogged?: (hours: number) => void
}

export default function TimeTracker({ taskId, taskName, projectId: _projectId, onTimeLogged }: TimeTrackerProps) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [showLog, setShowLog] = useState(false)
  const [manualHours, setManualHours] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const startRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const start = () => {
    startRef.current = Date.now() - elapsed * 1000
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    setRunning(true)
  }

  const stop = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setRunning(false)
    const hours = elapsed / 3600
    if (hours >= 0.1) {
      await logTime(hours, `Timer: ${taskName}`)
    }
    setElapsed(0)
  }

  const logTime = async (hours: number, desc: string) => {
    setSaving(true)
    try {
      await tasksApi.logTime(taskId, { hours, date: new Date().toISOString().split('T')[0], description: desc })
      onTimeLogged?.(hours)
      setManualHours('')
      setDescription('')
      setShowLog(false)
    } finally { setSaving(false) }
  }

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="border-t border-gray-100 pt-3 mt-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-2">
        <Clock size={12} />
        Time Tracking
      </div>
      <div className="flex items-center gap-2">
        {/* Timer */}
        <div className="flex items-center gap-1.5 flex-1">
          <button
            onClick={running ? stop : start}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              running
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {running ? <Square size={12} /> : <Play size={12} />}
            {running ? 'Stop' : 'Start'}
          </button>
          {(running || elapsed > 0) && (
            <span className={`text-sm font-mono font-bold ${running ? 'text-green-600 animate-pulse' : 'text-gray-600'}`}>
              {formatTime(elapsed)}
            </span>
          )}
        </div>

        {/* Manual log */}
        <button
          onClick={() => setShowLog(!showLog)}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
        >
          + Log <ChevronDown size={10} className={showLog ? 'rotate-180' : ''} />
        </button>
      </div>

      {showLog && (
        <div className="mt-2 space-y-2 p-2 bg-gray-50 rounded-lg">
          <div className="flex gap-2">
            <input
              type="number"
              min="0.1"
              step="0.25"
              value={manualHours}
              onChange={e => setManualHours(e.target.value)}
              placeholder="Hours (e.g. 1.5)"
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What did you work on?"
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => manualHours && logTime(parseFloat(manualHours), description || taskName)}
            disabled={!manualHours || isNaN(parseFloat(manualHours)) || saving}
            className="w-full text-xs bg-blue-600 text-white py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Logging...' : 'Log Time'}
          </button>
        </div>
      )}
    </div>
  )
}
