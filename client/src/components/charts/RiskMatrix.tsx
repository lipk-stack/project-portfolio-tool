import { Risk } from '../../types'

const PROB_LABELS = ['Low', 'Medium', 'High']
const IMPACT_LABELS = ['Low', 'Medium', 'High']

const CELL_COLORS: Record<string, string> = {
  '0-0': 'bg-green-100', '0-1': 'bg-green-200', '0-2': 'bg-yellow-100',
  '1-0': 'bg-green-200', '1-1': 'bg-yellow-200', '1-2': 'bg-orange-200',
  '2-0': 'bg-yellow-100', '2-1': 'bg-orange-200', '2-2': 'bg-red-200',
}

const RISK_LEVEL_IDX = { low: 0, medium: 1, high: 2 }

interface Props {
  risks: Risk[]
  onRiskClick?: (risk: Risk) => void
}

export default function RiskMatrix({ risks, onRiskClick }: Props) {
  const openRisks = risks.filter(r => r.status !== 'closed')

  const getCell = (probIdx: number, impactIdx: number) =>
    openRisks.filter(r =>
      RISK_LEVEL_IDX[r.probability] === probIdx &&
      RISK_LEVEL_IDX[r.impact] === impactIdx
    )

  const getScoreColor = (score: number) =>
    score >= 6 ? 'bg-red-500' : score >= 3 ? 'bg-yellow-500' : 'bg-green-500'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {openRisks.length} open risks mapped by probability × impact
        </p>
        <div className="flex items-center gap-3 text-xs">
          {[['bg-green-200', 'Low'], ['bg-yellow-200', 'Medium'], ['bg-orange-200', 'High'], ['bg-red-200', 'Critical']].map(([c, l]) => (
            <div key={l} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded ${c}`} />
              <span className="text-gray-500">{l}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        {/* Y axis label */}
        <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-gray-500 font-medium whitespace-nowrap">
          Probability →
        </div>

        <div className="ml-4">
          {/* Grid */}
          <div className="grid grid-cols-3 gap-1">
            {[2, 1, 0].map(probIdx => (
              IMPACT_LABELS.map((_, impactIdx) => {
                const cellRisks = getCell(probIdx, impactIdx)
                const colorKey = `${probIdx}-${impactIdx}`
                return (
                  <div
                    key={`${probIdx}-${impactIdx}`}
                    className={`${CELL_COLORS[colorKey]} rounded-lg min-h-[80px] p-2 relative`}
                  >
                    <div className="text-xs text-gray-400 mb-1">
                      {PROB_LABELS[probIdx]} P × {IMPACT_LABELS[impactIdx]} I
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {cellRisks.map(r => (
                        <button
                          key={r.id}
                          onClick={() => onRiskClick?.(r)}
                          title={r.title}
                          className={`${getScoreColor(r.score)} text-white text-xs rounded px-1.5 py-0.5 truncate max-w-full hover:opacity-80 transition-opacity`}
                        >
                          {r.title.length > 16 ? r.title.slice(0, 16) + '…' : r.title}
                        </button>
                      ))}
                    </div>
                    {cellRisks.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-300">
                        —
                      </div>
                    )}
                  </div>
                )
              })
            ))}
          </div>

          {/* X axis labels */}
          <div className="grid grid-cols-3 gap-1 mt-1">
            {IMPACT_LABELS.map(l => (
              <div key={l} className="text-center text-xs text-gray-500 font-medium">{l} Impact</div>
            ))}
          </div>
          <div className="text-center text-xs text-gray-500 mt-0.5">← Impact →</div>
        </div>
      </div>
    </div>
  )
}
