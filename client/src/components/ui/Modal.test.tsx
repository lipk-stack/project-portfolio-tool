import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from './Modal'

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="Hidden">body</Modal>,
    )
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText('Hidden')).toBeNull()
  })

  it('renders title, children and footer when open', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Settings" footer={<button>Save</button>}>
        <p>body content</p>
      </Modal>,
    )
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('body content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('calls onClose when the Escape key is pressed', async () => {
    const onClose = vi.fn()
    render(<Modal isOpen onClose={onClose} title="X">body</Modal>)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = vi.fn()
    const { container } = render(<Modal isOpen onClose={onClose} title="X">body</Modal>)
    const backdrop = container.querySelector('.absolute.inset-0') as HTMLElement
    await userEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
