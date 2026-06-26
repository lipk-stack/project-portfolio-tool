import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Progress from './Progress'

// The inner bar is the element carrying the width style.
function bar(container: HTMLElement): HTMLElement {
  return container.querySelector('[style*="width"]') as HTMLElement
}

describe('Progress', () => {
  it('computes the percentage from value/max', () => {
    const { container } = render(<Progress value={25} max={50} />)
    expect(bar(container).style.width).toBe('50%')
  })

  it('clamps the percentage at 100 when value exceeds max', () => {
    const { container } = render(<Progress value={150} max={100} />)
    expect(bar(container).style.width).toBe('100%')
  })

  it('renders the rounded percentage label when showLabel is set', () => {
    render(<Progress value={33.4} showLabel />)
    expect(screen.getByText('33%')).toBeInTheDocument()
  })

  it('hides the label by default', () => {
    render(<Progress value={40} />)
    expect(screen.queryByText('40%')).toBeNull()
  })

  it('auto color picks green at or above 80%', () => {
    const { container } = render(<Progress value={90} color="auto" />)
    expect(bar(container).className).toContain('bg-green-500')
  })

  it('auto color picks red below 30%', () => {
    const { container } = render(<Progress value={10} color="auto" />)
    expect(bar(container).className).toContain('bg-red-500')
  })
})
