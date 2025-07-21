import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { config } from '../../config/config.js'
import { AUTHENTICATION_MESSAGES } from '../common/constants/authentication-constants.js'

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
    // Reset config after test
    config.set('auth.sharedPassword', null)
  })

  describe('POST /login', () => {
    test('Should redirect to home page when correct password is provided', async () => {
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

    test('Should return 401 with error message when incorrect password is provided', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'wrong-password'
        }
      })

      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: AUTHENTICATION_MESSAGES.INVALID_PASSWORD
      })
    })

    test('Should return 401 with error message when no password is provided', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {}
      })

      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: AUTHENTICATION_MESSAGES.INVALID_PASSWORD
      })
    })

    test('Should return 401 with error message when empty string password is provided', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: ''
        }
      })

      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: AUTHENTICATION_MESSAGES.INVALID_PASSWORD
      })
    })

    test('Should return 401 with error message when whitespace-only password is provided', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: '   '
        }
      })

      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: AUTHENTICATION_MESSAGES.INVALID_PASSWORD
      })
    })

    test('Should return 401 with error message when non-string password is provided', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 123
        }
      })

      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(result).toEqual({
        message: AUTHENTICATION_MESSAGES.INVALID_PASSWORD
      })
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
