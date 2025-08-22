import { vi } from 'vitest'
import { statusCodes } from '../common/constants/status-codes.js'
import { AUTHENTICATION_MESSAGES } from '../common/constants/authentication-constants.js'
import { createServer } from '../server.js'
import {
  createMockH,
  createMockRequest
} from '../common/test-helpers/mock-request.js'
import { showLoginFormController } from './controller.js'
import { buildAuthorizationUrl } from '../authentication/azure-ad-url-builder.js'
import { storeStateParameter } from '../authentication/oauth-state-storage.js'
import { getSession, processAuthCallback } from './authCallbackService.js'

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

// Mock OAuth crypto service
vi.mock('../authentication/oauth-crypto-service.js', () => ({
  generateStateParameter: vi.fn(() => 'mock-state-parameter'),
  generatePkceChallenge: vi.fn(() => ({
    codeVerifier: 'mock-code-verifier',
    codeChallenge: 'mock-code-challenge'
  }))
}))

// Mock OAuth state storage
vi.mock('../authentication/oauth-state-storage.js', () => ({
  storeStateParameter: vi.fn().mockResolvedValue(undefined),
  storePkceVerifier: vi.fn().mockResolvedValue(undefined)
}))

// Mock Azure AD URL builder
vi.mock('../authentication/azure-ad-url-builder.js', () => ({
  buildAuthorizationUrl: vi.fn(
    (state, challenge) =>
      `https://test-auth-server.com/dev-tenant-id/oauth2/v2.0/authorize?state=${state}&code_challenge=${challenge}`
  )
}))

// Mock authCallbackService
vi.mock('./authCallbackService.js', () => ({
  processAuthCallback: vi.fn(),
  getSession: vi.fn()
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
        'https://test-auth-server.com/dev-tenant-id/oauth2/v2.0/authorize?state=mock-state-parameter&code_challenge=mock-code-challenge'
      )
    })

    test('Should redirect to home when user already has valid session', async () => {
      // This test validates the BDD requirement: "redirect to home when user already has valid session"
      // We don't need to test HAPI cookie parsing - just that the controller logic works

      // Mock that getSession returns a valid session
      vi.mocked(getSession).mockResolvedValueOnce({
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

    test('Should show error page when Azure AD configuration is missing', async () => {
      buildAuthorizationUrl.mockImplementationOnce(() => {
        throw new Error('Azure AD configuration is incomplete')
      })

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/login'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(AUTHENTICATION_MESSAGES.AZURE_AD_UNAVAILABLE)
      expect(result).toContain('govuk-error-message')
    })

    test('Should show error page when Redis is unavailable', async () => {
      storeStateParameter.mockRejectedValueOnce(
        new Error('Redis connection failed')
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
      // Given: Service processes authentication successfully
      vi.mocked(processAuthCallback).mockResolvedValueOnce({
        success: true,
        sessionData: {
          session_id: 'test-session-id',
          session_token: 'test-token',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString()
        }
      })

      // When: OAuth callback is received with valid parameters
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/auth/callback?code=mock-auth-code&state=mock-state'
      })

      // Then: User is redirected to home
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe('/upload-document')

      // And: Service was called with correct parameters
      expect(processAuthCallback).toHaveBeenCalledWith(
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
      expect(processAuthCallback).not.toHaveBeenCalled()
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
      expect(processAuthCallback).not.toHaveBeenCalled()
    })

    test('Should show expired error when service reports invalid state', async () => {
      // Given: Service reports invalid state
      vi.mocked(processAuthCallback).mockResolvedValueOnce({
        success: false,
        error: 'INVALID_STATE',
        message: 'State validation failed'
      })

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

    test('Should show expired error when service reports missing PKCE', async () => {
      // Given: Service reports missing PKCE verifier
      vi.mocked(processAuthCallback).mockResolvedValueOnce({
        success: false,
        error: 'MISSING_PKCE',
        message: 'PKCE verifier not found'
      })

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
      vi.mocked(processAuthCallback).mockRejectedValueOnce(
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
      // Given: Service processes authentication successfully
      const sessionId = 'test-session-id'
      vi.mocked(processAuthCallback).mockResolvedValueOnce({
        success: true,
        sessionData: {
          session_id: sessionId,
          session_token: 'test-token',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString()
        }
      })

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
