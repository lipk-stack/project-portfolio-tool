import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge, HealthBadge, PriorityBadge, StatusBadge, HealthDot } from './Badge'

describe('Badge', () => {
  it('renders children and the default variant classes', () => {
    render(<Badge>Hello</Badge>)
    const el = screen.getByText('Hello')
    expect(el).toBeInTheDocument()
    expect(el.className).toContain('bg-blue-100')
  })

  it('renders a leading dot only when dot is set', () => {
    const { container, rerender } = render(<Badge variant="danger">No dot</Badge>)
    // the badge <span> wraps text; a dot would add a second inner span
    expect(container.querySelectorAll('span > span').length).toBe(0)
    rerender(<Badge variant="danger" dot>With dot</Badge>)
    const dot = container.querySelector('span > span')
    expect(dot).not.toBeNull()
    expect(dot!.className).toContain('bg-red-500')
  })

  it('applies the larger padding for size md', () => {
    render(<Badge size="md">Big</Badge>)
    expect(screen.getByText('Big').className).toContain('px-2.5')
  })
})

describe('HealthBadge', () => {
  it('maps each health value to its label', () => {
    const { rerender } = render(<HealthBadge health="green" />)
    expect(screen.getByText('On Track')).toBeInTheDocument()
    rerender(<HealthBadge health="yellow" />)
    expect(screen.getByText('At Risk')).toBeInTheDocument()
    rerender(<HealthBadge health="red" />)
    expect(screen.getByText('Off Track')).toBeInTheDocument()
  })
})

describe('PriorityBadge', () => {
  it('maps each priority to its label', () => {
    const { rerender } = render(<PriorityBadge priority="low" />)
    expect(screen.getByText('Low')).toBeInTheDocument()
    rerender(<PriorityBadge priority="critical" />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })
})

describe('StatusBadge', () => {
  it('maps known statuses to a friendly label', () => {
    const { rerender } = render(<StatusBadge status="in_progress" />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    rerender(<StatusBadge status="on_hold" />)
    expect(screen.getByText('On Hold')).toBeInTheDocument()
  })

  it('falls back to the raw status string when unknown', () => {
    // @ts-expect-error — exercising the runtime fallback branch
    render(<StatusBadge status="archived" />)
    expect(screen.getByText('archived')).toBeInTheDocument()
  })
})

describe('HealthDot', () => {
  it('colors the dot by health', () => {
    const { container } = render(<HealthDot health="red" />)
    expect(container.firstChild).toHaveClass('bg-red-500')
  })
})
