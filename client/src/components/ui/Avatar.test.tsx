import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Avatar, { AvatarGroup } from './Avatar'

describe('Avatar', () => {
  it('derives uppercase initials from a two-word name', () => {
    render(<Avatar name="John Manager" />)
    expect(screen.getByText('JM')).toBeInTheDocument()
  })

  it('uses a single initial for a one-word name', () => {
    render(<Avatar name="madonna" />)
    expect(screen.getByText('M')).toBeInTheDocument()
  })

  it('caps initials at two characters for longer names', () => {
    render(<Avatar name="Anna Bob Carol" />)
    expect(screen.getByText('AB')).toBeInTheDocument()
  })

  it('is deterministic about its auto color for a given name', () => {
    const { container: a } = render(<Avatar name="Repeatable" />)
    const { container: b } = render(<Avatar name="Repeatable" />)
    const classOf = (c: HTMLElement) => Array.from(c.firstElementChild!.classList).find((x) => x.startsWith('bg-'))
    expect(classOf(a)).toBe(classOf(b))
  })

  it('honors an explicit color override', () => {
    const { container } = render(<Avatar name="X" color="bg-emerald-600" />)
    expect(container.firstChild).toHaveClass('bg-emerald-600')
  })
})

describe('AvatarGroup', () => {
  it('shows every avatar when under the max', () => {
    render(<AvatarGroup names={['Al Pha', 'Be Ta']} max={3} />)
    expect(screen.getByText('AP')).toBeInTheDocument()
    expect(screen.getByText('BT')).toBeInTheDocument()
    expect(screen.queryByText(/^\+/)).toBeNull()
  })

  it('renders a +N overflow chip when over the max', () => {
    render(<AvatarGroup names={['A A', 'B B', 'C C', 'D D', 'E E']} max={3} />)
    expect(screen.getByText('+2')).toBeInTheDocument()
  })
})
