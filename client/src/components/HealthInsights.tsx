import { useNavigate } from 'react-router-dom'
import { Sparkles, ArrowRight } from 'lucide-react'
import Card from './ui/Card'
import { Rag, HealthFactor, ProjectHealth, PortfolioInsights } from '../types'

const RAG_TEXT: Record<Rag, string> = { green: 'text-green-600', amber: 'text-amber-600', red: 'text-red-600' }
const RAG_BG: Record<Rag, string> = { green: 'bg-green-500', amber: 'bg-amber-500', red: 'bg-red-500' }
const RAG_SOFT: Record<Rag, string> = { green: 'bg-green-50 text-green-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700' }
const RAG_RING: Record<Rag, string> = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444' }

function ragOf(rag: Rag | 'na'): Rag {
  return rag === 'na' ? 'green' : rag
}

// Circular score gauge (pure SVG, no chart lib needed).
export function ScoreRing({ score, rag, size = 72 }: { score: number; rag: Rag; size?: number }) {
  const stroke = size > 60 ? 7 : 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.max(0, Math.min(100, score)) / 100)
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RAG_RING[rag]} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-bold ${RAG_TEXT[rag]}`} style={{ fontSize: size > 60 ? 18 : 13 }}>{score}</span>
      </div>
    </div>
  )
}

// Small inline chip used in lists/tables.
export function HealthChip({ score, rag }: { score: number; rag: Rag }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${RAG_SOFT[rag]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${RAG_BG[rag]}`} />
      {score}
    </span>
  )
}

function FactorBar({ factor }: { factor: HealthFactor }) {
  const rag = ragOf(factor.rag)
  const na = factor.rag === 'na'
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-20 text-xs font-medium text-gray-600 flex-shrink-0">{factor.label}</span>
      {na ? (
        <span className="text-xs text-gray-400">No data yet</span>
      ) : (
        <>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${RAG_BG[rag]}`} />
          <span className="text-xs text-gray-600 flex-1 min-w-0">{factor.detail}</span>
        </>
      )}
    </div>
  )
}

// Per-project insight panel (used on the project detail page).
export function ProjectInsightPanel({ health }: { health: ProjectHealth }) {
  return (
    <Card>
      <div className="flex items-start gap-4">
        <ScoreRing score={health.score} rag={health.rag} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={15} className="text-blue-600 flex-shrink-0" />
            <h3 className="font-semibold text-gray-900">Health Insights</h3>
            <span className={`text-xs font-semibold uppercase tracking-wide ${RAG_TEXT[health.rag]}`}>{health.rag}</span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{health.summary}</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        {health.factors.map((f) => <FactorBar key={f.key} factor={f} />)}
      </div>
    </Card>
  )
}

// Portfolio-level auto-insights card (used on the dashboard).
export function PortfolioInsightsCard({ data }: { data: PortfolioInsights }) {
  const navigate = useNavigate()
  const { overall, needsAttention } = data
  return (
    <Card padding="none">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles size={16} className="text-blue-600" /> Portfolio Health &amp; Auto-Insights
        </h2>
        <span className="text-xs text-gray-400">Rule-based health scoring</span>
      </div>
      <div className="grid grid-cols-12 gap-0">
        <div className="col-span-12 md:col-span-4 flex items-center gap-4 px-5 py-5 border-b md:border-b-0 md:border-r border-gray-100">
          <ScoreRing score={overall.score} rag={overall.rag} size={84} />
          <div>
            <div className="text-sm font-medium text-gray-700">Overall health</div>
            <div className="text-xs text-gray-400 mb-2">{overall.projectCount} active project{overall.projectCount === 1 ? '' : 's'}</div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />{overall.counts.green}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{overall.counts.amber}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />{overall.counts.red}</span>
            </div>
          </div>
        </div>
        <div className="col-span-12 md:col-span-8 px-5 py-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Needs attention</div>
          {needsAttention.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">All projects are healthy — no action needed.</div>
          ) : (
            <div className="space-y-1">
              {needsAttention.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 text-left transition-colors group"
                >
                  <HealthChip score={p.score} rag={p.rag} />
                  <span className="text-sm text-gray-700 truncate flex-1">{p.headline}</span>
                  <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
