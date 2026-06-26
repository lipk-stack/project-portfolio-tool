import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import {
  ScoreRing,
  HealthChip,
  Sparkline,
  HealthTrendStrip,
  ProjectInsightPanel,
  PortfolioInsightsCard,
} from './HealthInsights'
import type { HealthTrend, ProjectHealth, PortfolioInsights } from '../types'

const trendUp: HealthTrend = {
  points: [
    { date: '2026-06-20', score: 60 },
    { date: '2026-06-23', score: 68 },
    { date: '2026-06-25', score: 75 },
  ],
  current: 75,
  previous: 60,
  delta: 15,
  direction: 'up',
  min: 60,
  max: 75,
}

describe('ScoreRing', () => {
  it('shows the score number', () => {
    render(<ScoreRing score={72} rag="amber" />)
    expect(screen.getByText('72')).toBeInTheDocument()
  })
})

describe('HealthChip', () => {
  it('renders the score with the rag soft style', () => {
    const { container } = render(<HealthChip score={40} rag="red" />)
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('text-red-700')
  })
})

describe('Sparkline', () => {
  it('shows a placeholder when there is not enough history', () => {
    render(<Sparkline points={[50]} color="#000" />)
    expect(screen.getByText('Not enough history yet')).toBeInTheDocument()
  })

  it('draws a line and area path when there are enough points', () => {
    const { container } = render(<Sparkline points={[10, 50, 90]} color="#000" />)
    expect(container.querySelectorAll('path').length).toBe(2)
    expect(container.querySelector('circle')).not.toBeNull()
  })
})

describe('HealthTrendStrip', () => {
  it('renders an upward delta with a + sign and the day count', () => {
    const { container } = render(<HealthTrendStrip trend={trendUp} rag="amber" />)
    expect(screen.getByText(/\+15 pts/)).toBeInTheDocument()
    expect(screen.getByText(/over 3 days/)).toBeInTheDocument()
    expect(container.querySelector('.lucide-trending-up')).not.toBeNull()
  })

  it('uses a downward icon and no + sign when declining', () => {
    const down: HealthTrend = { ...trendUp, delta: -8, direction: 'down' }
    const { container } = render(<HealthTrendStrip trend={down} rag="red" />)
    expect(screen.getByText(/-8 pts/)).toBeInTheDocument()
    expect(container.querySelector('.lucide-trending-down')).not.toBeNull()
  })
})

describe('ProjectInsightPanel', () => {
  const health: ProjectHealth = {
    id: 1,
    name: 'Apollo',
    color: '#fff',
    score: 72,
    rag: 'amber',
    cpi: 0.9,
    factors: [
      { key: 'schedule', label: 'Schedule', rag: 'green', penalty: 0, detail: 'On time' },
      { key: 'risk', label: 'Risk', rag: 'na', penalty: 0, detail: '' },
    ],
    headline: 'Tracking slightly behind',
    summary: 'The project is tracking slightly behind plan.',
  }

  it('renders the summary and each scored factor', () => {
    render(<ProjectInsightPanel health={health} />)
    expect(screen.getByText(health.summary)).toBeInTheDocument()
    expect(screen.getByText('On time')).toBeInTheDocument()
  })

  it("shows 'No data yet' for a factor with no rag", () => {
    render(<ProjectInsightPanel health={health} />)
    expect(screen.getByText('No data yet')).toBeInTheDocument()
  })

  it('renders the trend strip only when a multi-point trend is supplied', () => {
    const { rerender } = render(<ProjectInsightPanel health={health} />)
    expect(screen.queryByText(/pts/)).toBeNull()
    rerender(<ProjectInsightPanel health={health} trend={trendUp} />)
    expect(screen.getByText(/\+15 pts/)).toBeInTheDocument()
  })
})

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}

function renderWithRouter(ui: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="*" element={<>{ui}<LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PortfolioInsightsCard', () => {
  const base: PortfolioInsights = {
    overall: { score: 68, rag: 'amber', projectCount: 3, counts: { green: 1, amber: 1, red: 1 } },
    needsAttention: [
      { id: 7, name: 'Phoenix', score: 40, rag: 'red', color: '#f00', headline: 'Behind schedule' },
    ],
    projects: [],
  }

  it('lists projects that need attention', () => {
    renderWithRouter(<PortfolioInsightsCard data={base} />)
    expect(screen.getByText('Behind schedule')).toBeInTheDocument()
  })

  it('navigates to the project when an attention item is clicked', async () => {
    renderWithRouter(<PortfolioInsightsCard data={base} />)
    await userEvent.click(screen.getByText('Behind schedule'))
    expect(screen.getByTestId('loc')).toHaveTextContent('/projects/7')
  })

  it('shows the all-healthy empty state when nothing needs attention', () => {
    renderWithRouter(<PortfolioInsightsCard data={{ ...base, needsAttention: [] }} />)
    expect(screen.getByText(/All projects are healthy/)).toBeInTheDocument()
  })
})
