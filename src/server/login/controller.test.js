import { vi } from 'vitest'
import { statusCodes } from '../common/constants/status-codes.js'
import { AUTHENTICATION_MESSAGES } from '../common/constants/authentication-constants.js'
import { createServer } from '../server.js'
import {
  createMockH,
  createMockRequest
} from '../common/test-helpers/mock-request.js'
import { showLoginFormController } from './controller.js'
import {
  initiateOauthFlow,
  getSessionFromId,
  authenticateWithCallback
} from '../authentication/authenticationService.js'

// Mock the buildRedisClient function to return our mock
vi.mock('../common/helpers/redis-client.js', () => {
  const mockRedisClient = {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    on: vi.fn()
  }

  return {
    buildRedisClient: vi.fn(() => mockRedisClient),
    __mockRedisClient: mockRedisClient
  }
})

// Mock authentication service
vi.mock('../authentication/authenticationService.js', () => ({
  initiateOauthFlow: vi.fn(() =>
    Promise.resolve(
      'https://test-auth-server.com/dev-tenant-id/oauth2/v2.0/authorize?state=mock-state&code_challenge=mock-challenge'
    )
  ),
  authenticateWithCallback: vi.fn(),
  getSessionFromId: vi.fn()
}))

describe('#loginController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('GET /login', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test('Should redirect to Azure AD when user is not authenticated', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/login'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        'https://test-auth-server.com/dev-tenant-id/oauth2/v2.0/authorize?state=mock-state&code_challenge=mock-challenge'
      )
    })

    test('Should redirect to home when user already has valid session', async () => {
      // This test validates the BDD requirement: "redirect to home when user already has valid session"
      // We don't need to test HAPI cookie parsing - just that the controller logic works

      // Mock that getSession returns a valid session
      vi.mocked(getSessionFromId).mockResolvedValueOnce({
        session_id: 'existing-session',
        session_token: 'valid-token'
      })

      // Mock that request.state.session has a session ID (HAPI handles cookie parsing)
      const mockRequest = createMockRequest({
        state: { session: 'existing-session' }
      })
      const mockH = createMockH()

      // Call controller directly to test logic
      const result = await showLoginFormController.handler(mockRequest, mockH)

      expect(mockH.redirect).toHaveBeenCalledWith('/upload-document')
      expect(result).toBe('redirect-response')
    })

    test('Should show error page when OAuth flow initialization fails', async () => {
      vi.mocked(initiateOauthFlow).mockRejectedValueOnce(
        new Error('OAuth initialization failed')
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/login'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(AUTHENTICATION_MESSAGES.AZURE_AD_UNAVAILABLE)
      expect(result).toContain('govuk-error-message')
    })
  })

  describe('GET /auth/callback', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test('Should handle successful OAuth callback and redirect to home', async () => {
      // Given: Service authenticates successfully
      const sessionData = {
        session_id: 'test-session-id',
        session_token: 'test-token',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString()
      }
      vi.mocked(authenticateWithCallback).mockResolvedValueOnce(sessionData)

      // When: OAuth callback is received with valid parameters
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/auth/callback?code=mock-auth-code&state=mock-state'
      })

      // Then: User is redirected to home
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe('/upload-document')

      // And: Service was called with correct parameters
      expect(authenticateWithCallback).toHaveBeenCalledWith(
        'mock-auth-code',
        'mock-state'
      )
    })

    test('Should show error page when OAuth provider returns error', async () => {
      // When: OAuth callback contains an error parameter
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/auth/callback?error=access_denied&error_description=User+cancelled'
      })

      // Then: Error page is shown
      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(AUTHENTICATION_MESSAGES.AZURE_AD_UNAVAILABLE)
      expect(result).toContain('govuk-error-message')

      // And: Service is not called
      expect(authenticateWithCallback).not.toHaveBeenCalled()
    })

    test('Should show error page when required parameters are missing', async () => {
      // When: OAuth callback is missing required parameters
      const testCases = [
        { url: '/auth/callback?state=mock-state', description: 'missing code' },
        {
          url: '/auth/callback?code=mock-auth-code',
          description: 'missing state'
        },
        { url: '/auth/callback', description: 'missing both parameters' }
      ]

      for (const testCase of testCases) {
        const { statusCode, result } = await server.inject({
          method: 'GET',
          url: testCase.url
        })

        // Then: Error page is shown for each case
        expect(statusCode).toBe(statusCodes.ok)
        expect(result).toContain(
          AUTHENTICATION_MESSAGES.INVALID_AUTHENTICATION_RESPONSE
        )
        expect(result).toContain('govuk-error-message')
      }

      // And: Service is never called
      expect(authenticateWithCallback).not.toHaveBeenCalled()
    })

    test('Should show expired error when service throws invalid state error', async () => {
      // Given: Service throws invalid state error
      const error = new Error('State validation failed')
      error.code = 'INVALID_STATE'
      vi.mocked(authenticateWithCallback).mockRejectedValueOnce(error)

      // When: OAuth callback is processed
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/auth/callback?code=mock-auth-code&state=invalid-state'
      })

      // Then: Expired authentication error is shown
      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        AUTHENTICATION_MESSAGES.AUTHENTICATION_REQUEST_EXPIRED
      )
      expect(result).toContain('govuk-error-message')
    })

    test('Should show expired error when service throws missing PKCE error', async () => {
      // Given: Service throws missing PKCE error
      const error = new Error('PKCE verifier not found')
      error.code = 'MISSING_PKCE'
      vi.mocked(authenticateWithCallback).mockRejectedValueOnce(error)

      // When: OAuth callback is processed
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/auth/callback?code=mock-auth-code&state=mock-state'
      })

      // Then: Expired authentication error is shown
      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        AUTHENTICATION_MESSAGES.AUTHENTICATION_REQUEST_EXPIRED
      )
      expect(result).toContain('govuk-error-message')
    })

    test('Should show authentication failed error when service throws exception', async () => {
      // Given: Service throws an exception
      vi.mocked(authenticateWithCallback).mockRejectedValueOnce(
        new Error('Token exchange failed')
      )

      // When: OAuth callback is processed
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/auth/callback?code=mock-auth-code&state=mock-state'
      })

      // Then: Authentication failed error is shown
      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(AUTHENTICATION_MESSAGES.AUTHENTICATION_FAILED)
      expect(result).toContain('govuk-error-message')
    })

    test('Should set session cookie when authentication succeeds', async () => {
      // Given: Service authenticates successfully
      const sessionId = 'test-session-id'
      const sessionData = {
        session_id: sessionId,
        session_token: 'test-token',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString()
      }
      vi.mocked(authenticateWithCallback).mockResolvedValueOnce(sessionData)

      // When: OAuth callback is processed
      const response = await server.inject({
        method: 'GET',
        url: '/auth/callback?code=mock-auth-code&state=mock-state'
      })

      // Then: Session cookie is set (check for Set-Cookie header)
      expect(response.headers['set-cookie']).toBeDefined()
      expect(response.statusCode).toBe(statusCodes.redirect)
    })
  })
})
