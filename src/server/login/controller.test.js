import { vi } from 'vitest'
import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { AUTHENTICATION_MESSAGES } from '../common/constants/authentication-constants.js'
import { config } from '../../config/config.js'

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

describe('#loginController', () => {
  let server
  let testPassword

  beforeAll(async () => {
    // Use environment-specific configuration (test.json provides default)
    testPassword = config.get('auth.sharedPassword')
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('GET /login', () => {
    test('Should render login form page', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/login'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(expect.stringContaining('Sign in |'))
      expect(result).toEqual(expect.stringContaining('Password'))
      expect(result).toEqual(expect.stringContaining('Continue'))
    })

    test('Should include UCD Toolkit service name in title', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/login'
      })

      expect(result).toEqual(
        expect.stringContaining(
          '<title>Sign in | ai-sdlc-ucd-tool-frontend</title>'
        )
      )
    })

    test('Should contain password form with proper GDS styling', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/login'
      })

      expect(result).toEqual(expect.stringContaining('govuk-form-group'))
      expect(result).toEqual(expect.stringContaining('govuk-label'))
      expect(result).toEqual(expect.stringContaining('govuk-input'))
      expect(result).toEqual(expect.stringContaining('govuk-button'))
      expect(result).toEqual(expect.stringContaining('type="password"'))
      expect(result).toEqual(expect.stringContaining('name="password"'))
    })
  })

  describe('POST /login', () => {
    test('Should redirect to home page when correct password is provided', async () => {
      const correctPassword = config.get('auth.sharedPassword')

      const { statusCode, headers, result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: correctPassword
        }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(headers.location).toBe('/')
      expect(result).toEqual({
        message: AUTHENTICATION_MESSAGES.SUCCESS_MESSAGE
      })
    })

    test('Should return login form with error message when incorrect password is provided', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'wrong-password'
        }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Invalid password. Please try again.')
      expect(result).toContain('govuk-error-message')
      expect(result).toContain('govuk-form-group--error')
    })

    test('Should return login form with error message when no password is provided', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {}
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Invalid password. Please try again.')
      expect(result).toContain('govuk-error-message')
      expect(result).toContain('govuk-form-group--error')
    })

    test('Should return login form with error message when empty string password is provided', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: ''
        }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Invalid password. Please try again.')
      expect(result).toContain('govuk-error-message')
      expect(result).toContain('govuk-form-group--error')
    })

    test('Should return login form with error message when whitespace-only password is provided', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: '   '
        }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Invalid password. Please try again.')
      expect(result).toContain('govuk-error-message')
      expect(result).toContain('govuk-form-group--error')
    })

    test('Should return login form with error message when non-string password is provided', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 123
        }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Invalid password. Please try again.')
      expect(result).toContain('govuk-error-message')
      expect(result).toContain('govuk-form-group--error')
    })

    test('Should validate password against SHARED_PASSWORD environment variable', async () => {
      // Test that it uses the actual configuration value
      const { statusCode, headers, result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: testPassword
        }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(headers.location).toBe('/')
      expect(result).toEqual({
        message: AUTHENTICATION_MESSAGES.SUCCESS_MESSAGE
      })
    })
  })
})
