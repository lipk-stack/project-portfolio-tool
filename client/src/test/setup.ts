// Registers jest-dom matchers (toBeInTheDocument, toHaveClass, …) on vitest's
// expect and runs DOM cleanup after every test. Referenced by vitest.config.ts.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
