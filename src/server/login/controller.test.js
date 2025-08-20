import { vi } from 'vitest'
import { statusCodes } from '../common/constants/status-codes.js'
import { AUTHENTICATION_MESSAGES } from '../common/constants/authentication-constants.js'
import { createServer } from '../server.js'
import {
  createMockRequest,
  createMockH
} from '../common/test-helpers/mock-request.js'

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
  storePkceVerifier: vi.fn().mockResolvedValue(undefined),
  validateStateParameter: vi.fn().mockResolvedValue(true),
  retrievePkceVerifier: vi.fn().mockResolvedValue('mock-code-verifier')
}))

// Mock Azure AD URL builder
vi.mock('../authentication/azure-ad-url-builder.js', () => ({
  buildAuthorizationUrl: vi.fn(
    (state, challenge) =>
      `https://test-auth-server.com/dev-tenant-id/oauth2/v2.0/authorize?state=${state}&code_challenge=${challenge}`
  )
}))

// Mock Azure AD token client
vi.mock('../authentication/azure-ad-token-client.js', () => ({
  exchangeCodeForTokens: vi.fn().mockResolvedValue({
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    id_token: 'mock-id-token',
    expires_in: 3600
  })
}))

// Mock session manager
vi.mock('../common/helpers/session-manager.js', () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  deleteSession: vi.fn()
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
      const { getSession } = await import(
        '../common/helpers/session-manager.js'
      )
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
      const { showLoginFormController } = await import('./controller.js')
      const result = await showLoginFormController.handler(mockRequest, mockH)

      expect(mockH.redirect).toHaveBeenCalledWith('/upload-document')
      expect(result).toBe('redirect-response')
    })

    test('Should show error page when Azure AD configuration is missing', async () => {
      const { buildAuthorizationUrl } = await import(
        '../authentication/azure-ad-url-builder.js'
      )
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
      const { storeStateParameter } = await import(
        '../authentication/oauth-state-storage.js'
      )
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
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/auth/callback?code=mock-auth-code&state=mock-state'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe('/upload-document')
    })

    test('Should handle OAuth error response from Azure AD', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/auth/callback?error=access_denied&error_description=User+cancelled'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(AUTHENTICATION_MESSAGES.AZURE_AD_UNAVAILABLE)
      expect(result).toContain('govuk-error-message')
    })

    test('Should handle missing authorization code parameter', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/auth/callback?state=mock-state'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        'Invalid authentication response. Please try again.'
      )
      expect(result).toContain('govuk-error-message')
    })

    test('Should handle missing state parameter', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/auth/callback?code=mock-auth-code'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        'Invalid authentication response. Please try again.'
      )
      expect(result).toContain('govuk-error-message')
    })

    test('Should handle invalid state parameter', async () => {
      const { validateStateParameter } = await import(
        '../authentication/oauth-state-storage.js'
      )
      validateStateParameter.mockResolvedValueOnce(false)

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/auth/callback?code=mock-auth-code&state=invalid-state'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        'Authentication request expired. Please try again.'
      )
      expect(result).toContain('govuk-error-message')
    })

    test('Should show error when PKCE verifier cannot be retrieved', async () => {
      const { retrievePkceVerifier } = await import(
        '../authentication/oauth-state-storage.js'
      )
      retrievePkceVerifier.mockResolvedValueOnce(null)

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/auth/callback?code=mock-auth-code&state=mock-state'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        'Authentication request expired. Please try again.'
      )
      expect(result).toContain('govuk-error-message')
    })

    test('Should handle token exchange failure', async () => {
      const { exchangeCodeForTokens } = await import(
        '../authentication/azure-ad-token-client.js'
      )
      exchangeCodeForTokens.mockRejectedValueOnce(
        new Error('Token exchange failed')
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/auth/callback?code=mock-auth-code&state=mock-state'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Authentication failed. Please try again.')
      expect(result).toContain('govuk-error-message')
    })

    test('Should create session on successful authentication', async () => {
      const { createSession } = await import(
        '../common/helpers/session-manager.js'
      )

      await server.inject({
        method: 'GET',
        url: '/auth/callback?code=mock-auth-code&state=mock-state'
      })

      expect(createSession).toHaveBeenCalledWith(expect.any(Object))
    })

    test('Should handle session creation failure and show error', async () => {
      const { createSession } = await import(
        '../common/helpers/session-manager.js'
      )
      createSession.mockRejectedValueOnce(new Error('Session creation failed'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/auth/callback?code=mock-auth-code&state=mock-state'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Authentication failed. Please try again.')
      expect(result).toContain('govuk-error-message')
    })
  })
})
