import { useState } from 'react'
import { Risk } from '../types'

interface RiskMatrixProps {
  risks: Risk[]
  onRiskClick?: (risk: Risk) => void
}

const LEVELS = ['low', 'medium', 'high', 'critical'] as const
const AXIS = ['low', 'medium', 'high'] as const

function getCellColor(prob: number, impact: number): string {
  const score = prob * impact
  if (score >= 6) return 'bg-red-100 border-red-200'
  if (score >= 3) return 'bg-orange-100 border-orange-200'
  if (score >= 2) return 'bg-yellow-100 border-yellow-200'
  return 'bg-green-100 border-green-200'
}

function getDotColor(score: number): string {
  if (score >= 6) return 'bg-red-500'
  if (score >= 4) return 'bg-orange-400'
  if (score >= 2) return 'bg-yellow-400'
  return 'bg-green-400'
}

const PROB_VAL: Record<string, number> = { low: 1, medium: 2, high: 3 }
const IMPACT_VAL: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 3 }

export default function RiskMatrix({ risks, onRiskClick }: RiskMatrixProps) {
  const [hovered, setHovered] = useState<Risk | null>(null)

  const activeRisks = risks.filter(r => r.status !== 'closed')

  const getRisksAt = (prob: string, impact: string) =>
    activeRisks.filter(r => r.probability === prob && r.impact === impact)

  return (
    <div className="relative">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-gray-700 mb-0.5">Risk Heat Matrix</h4>
        <p className="text-xs text-gray-400">{activeRisks.length} active risks plotted by probability × impact</p>
      </div>

      <div className="flex gap-2">
        {/* Y-axis label */}
        <div className="flex items-center justify-center w-5">
          <span className="text-xs text-gray-400 -rotate-90 whitespace-nowrap">Probability →</span>
        </div>

        <div className="flex-1">
          {/* Matrix grid */}
          <div className="grid" style={{ gridTemplateColumns: `auto repeat(3, 1fr)`, gap: '2px' }}>
            {/* Column headers */}
            <div className="h-6" />
            {AXIS.map(impact => (
              <div key={impact} className="h-6 flex items-center justify-center text-xs font-medium text-gray-500 capitalize">{impact}</div>
            ))}

            {/* Rows (high to low probability) */}
            {[...AXIS].reverse().map(prob => (
              <>
                <div key={`label-${prob}`} className="flex items-center justify-center w-12 text-xs font-medium text-gray-500 capitalize">{prob}</div>
                {AXIS.map(impact => {
                  const cellRisks = getRisksAt(prob, impact)
                  const probVal = PROB_VAL[prob]
                  const impactVal = IMPACT_VAL[impact]
                  const cellColor = getCellColor(probVal, impactVal)

                  return (
                    <div
                      key={`${prob}-${impact}`}
                      className={`relative rounded border ${cellColor} min-h-[60px] p-1.5 flex flex-wrap gap-1 items-start content-start`}
                    >
                      {cellRisks.map(risk => (
                        <button
                          key={risk.id}
                          onClick={() => onRiskClick?.(risk)}
                          onMouseEnter={() => setHovered(risk)}
                          onMouseLeave={() => setHovered(null)}
                          className={`w-5 h-5 rounded-full ${getDotColor(risk.score)} hover:scale-110 transition-transform flex-shrink-0 relative`}
                          title={risk.title}
                        />
                      ))}
                    </div>
                  )
                })}
              </>
            ))}
          </div>

          {/* X-axis label */}
          <div className="text-center mt-1 text-xs text-gray-400">Impact →</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {[
          { color: 'bg-red-500', label: 'Critical (≥6)' },
          { color: 'bg-orange-400', label: 'High (4-5)' },
          { color: 'bg-yellow-400', label: 'Medium (2-3)' },
          { color: 'bg-green-400', label: 'Low (1)' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className={`w-3 h-3 rounded-full ${color}`} />
            {label}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {hovered && (
        <div className="absolute z-20 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none max-w-[200px] shadow-xl" style={{ bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8 }}>
          <div className="font-semibold mb-0.5">{hovered.title}</div>
          <div className="text-gray-300">P: {hovered.probability} | I: {hovered.impact} | Score: {hovered.score}</div>
          {hovered.owner_name && <div className="text-gray-400 mt-0.5">Owner: {hovered.owner_name}</div>}
        </div>
      )}
    </div>
  )
}
