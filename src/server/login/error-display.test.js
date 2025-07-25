import { vi } from 'vitest'
import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

// Mock the buildRedisClient function to return our mock
vi.mock('../common/helpers/redis-client.js', () => {
  const mockRedisClient = {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    on: vi.fn()
  }

  return {
    buildRedisClient: vi.fn(() => mockRedisClient)
  }
})

// Mock session manager
vi.mock('../common/helpers/session-manager.js', () => ({
  createSession: vi.fn().mockResolvedValue({
    sessionId: 'test-session-id',
    sessionToken: 'test-token'
  })
}))

describe('Login Error Display', () => {
  let server

  beforeEach(async () => {
    vi.clearAllMocks()
    server = await createServer()
    await server.initialize()
  })

  afterEach(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('Error Display UI', () => {
    test('Should display error message in red below password field when password is incorrect', async () => {
      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'wrong-password'
        }
      })

      // Should return the login page with error message
      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('govuk-error-message')
      expect(result).toContain('Invalid password. Please try again.')
      expect(result).toContain('id="password-error"')
    })

    test('Should display error icon when password is incorrect', async () => {
      const { result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'wrong-password'
        }
      })

      // Check for error icon (using GDS error summary pattern)
      expect(result).toContain('govuk-error-summary')
      expect(result).toContain('Error:')
    })

    test('Should highlight password field with error styling', async () => {
      const { result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'wrong-password'
        }
      })

      // Check for error styling on form group
      expect(result).toContain('govuk-form-group--error')
      expect(result).toContain('govuk-input--error')
    })

    test('Should display service unavailable error when session creation fails', async () => {
      // Import the mocked module
      const sessionManager = await import(
        '../common/helpers/session-manager.js'
      )

      // Override the mock to reject for this test
      sessionManager.createSession.mockRejectedValueOnce(
        new Error('Redis connection failed')
      )

      const { result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'test-password-123' // Using correct password to trigger session creation
        }
      })

      expect(result).toContain(
        'Unable to process login. Please try again later.'
      )
      expect(result).toContain('govuk-error-message')

      // Restore the original mock
      sessionManager.createSession.mockResolvedValue({
        sessionId: 'test-session-id',
        sessionToken: 'test-token'
      })
    })
  })

  describe('ARIA Accessibility', () => {
    test('Should include ARIA live region for error announcements', async () => {
      const { result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'wrong-password'
        }
      })

      // Check for ARIA live region
      expect(result).toContain('aria-live="polite"')
      expect(result).toContain('role="alert"')
    })

    test('Should link error message to password field with aria-describedby', async () => {
      const { result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'wrong-password'
        }
      })

      // Check that password field has aria-describedby pointing to error
      expect(result).toMatch(
        /id="password"[^>]+aria-describedby="password-error"/
      )
    })
  })

  describe('Error Clearing', () => {
    test('Should not show error message on initial GET request', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/login'
      })

      // Check that the form doesn't have error class (not in JavaScript)
      expect(result).not.toMatch(/<div class="[^"]*govuk-form-group--error/)
      expect(result).not.toContain('govuk-error-message')
      expect(result).not.toContain('Invalid password. Please try again.')
    })

    test('Should preserve form data when showing error', async () => {
      const { result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'wrong-password'
        }
      })

      // Password field should be empty for security (not preserve incorrect password)
      expect(result).toMatch(/<input[^>]+id="password"[^>]+value=""/)
    })
  })
})
