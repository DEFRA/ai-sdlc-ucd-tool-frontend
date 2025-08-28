import { describe, test, vi } from 'vitest'
import {
  authenticateWithCallback,
  getSessionFromId,
  initiateOauthFlow
} from './authentication-service.js'
import {
  retrievePkceVerifier,
  storePkceVerifier,
  storeStateParameter,
  validateStateParameter
} from './oauth-state-storage.js'
import { exchangeCodeForTokens } from './azure-ad-token-client.js'
import {
  createSession,
  getSession as getSessionFromRepository
} from './session-repository.js'
import {
  generatePkceChallenge,
  generateStateParameter
} from './oauth-crypto-service.js'
import { buildAuthorizationUrl } from './azure-ad-url-builder.js'

// Mock dependencies
vi.mock('../authentication/oauth-state-storage.js', () => ({
  validateStateParameter: vi.fn(),
  retrievePkceVerifier: vi.fn(),
  storeStateParameter: vi.fn(),
  storePkceVerifier: vi.fn()
}))

vi.mock('../authentication/azure-ad-token-client.js', () => ({
  exchangeCodeForTokens: vi.fn()
}))

vi.mock('../authentication/session-repository.js', () => ({
  createSession: vi.fn(),
  getSession: vi.fn()
}))

vi.mock('../authentication/oauth-crypto-service.js', () => ({
  generatePkceChallenge: vi.fn(),
  generateStateParameter: vi.fn()
}))

vi.mock('../authentication/azure-ad-url-builder.js', () => ({
  buildAuthorizationUrl: vi.fn()
}))

// Test constants
const MOCK_STATE = 'test-state-parameter-123'
const MOCK_CODE_VERIFIER = 'test-code-verifier-abc'
const MOCK_CODE_CHALLENGE = 'test-code-challenge-xyz'
const MOCK_AUTH_URL =
  'https://login.microsoftonline.com/authorize?client_id=test&state=test'
const MOCK_AUTH_CODE = 'test-authorization-code'
const MOCK_SESSION_ID = 'test-session-id-456'
const MOCK_SESSION_TOKEN = 'test-session-token-789'
const MOCK_ACCESS_TOKEN = 'test-access-token'
const MOCK_REFRESH_TOKEN = 'test-refresh-token'

describe('authenticationService', () => {
  describe('initiateOauthFlow', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test('generates security parameters and returns authorization URL', async () => {
      // Given: Security parameters will be generated
      generateStateParameter.mockReturnValue(MOCK_STATE)
      generatePkceChallenge.mockReturnValue({
        codeVerifier: MOCK_CODE_VERIFIER,
        codeChallenge: MOCK_CODE_CHALLENGE
      })

      // And: Storage operations will succeed
      storeStateParameter.mockResolvedValueOnce(undefined)
      storePkceVerifier.mockResolvedValueOnce(undefined)

      // And: Authorization URL will be built
      buildAuthorizationUrl.mockReturnValue(MOCK_AUTH_URL)

      // When: Initiating the OAuth flow
      const result = await initiateOauthFlow()

      // Then: Returns the authorization URL
      expect(result).toBe(MOCK_AUTH_URL)

      // And: Security parameters are generated and stored in correct order
      expect(generateStateParameter).toHaveBeenCalled()
      expect(generatePkceChallenge).toHaveBeenCalled()
      expect(storeStateParameter).toHaveBeenCalledWith(MOCK_STATE)
      expect(storePkceVerifier).toHaveBeenCalledWith(
        MOCK_STATE,
        MOCK_CODE_VERIFIER
      )
      expect(buildAuthorizationUrl).toHaveBeenCalledWith(
        MOCK_STATE,
        MOCK_CODE_CHALLENGE
      )
    })

    test('throws error when state storage fails', async () => {
      // Given: State storage will fail
      generateStateParameter.mockReturnValue(MOCK_STATE)
      generatePkceChallenge.mockReturnValue({
        codeVerifier: MOCK_CODE_VERIFIER,
        codeChallenge: MOCK_CODE_CHALLENGE
      })
      storeStateParameter.mockRejectedValueOnce(new Error('Storage failed'))

      // When/Then: Initiating OAuth flow throws error
      await expect(initiateOauthFlow()).rejects.toThrow('Storage failed')
      expect(storeStateParameter).toHaveBeenCalledWith(MOCK_STATE)

      // And: Does not proceed with PKCE storage
      expect(storePkceVerifier).not.toHaveBeenCalled()
      expect(buildAuthorizationUrl).not.toHaveBeenCalled()
    })

    test('throws error when PKCE storage fails', async () => {
      // Given: PKCE storage will fail
      generateStateParameter.mockReturnValue(MOCK_STATE)
      generatePkceChallenge.mockReturnValue({
        codeVerifier: MOCK_CODE_VERIFIER,
        codeChallenge: MOCK_CODE_CHALLENGE
      })
      storeStateParameter.mockResolvedValueOnce(undefined)
      storePkceVerifier.mockRejectedValueOnce(new Error('PKCE storage failed'))

      // When/Then: Initiating OAuth flow throws error
      await expect(initiateOauthFlow()).rejects.toThrow('PKCE storage failed')

      // And: Does not proceed with URL building
      expect(buildAuthorizationUrl).not.toHaveBeenCalled()
    })
  })

  describe('when authenticating with OAuth callback', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test('returns session data when authentication is successful', async () => {
      // Given: Valid OAuth callback parameters
      const code = MOCK_AUTH_CODE
      const state = MOCK_STATE

      // And: State validation passes
      validateStateParameter.mockResolvedValueOnce(true)

      // And: PKCE verifier is retrieved successfully
      retrievePkceVerifier.mockResolvedValueOnce(MOCK_CODE_VERIFIER)

      // And: Token exchange succeeds
      exchangeCodeForTokens.mockResolvedValueOnce({
        access_token: MOCK_ACCESS_TOKEN,
        refresh_token: MOCK_REFRESH_TOKEN
      })

      // And: Session creation succeeds
      const mockSessionData = {
        session_id: MOCK_SESSION_ID,
        session_token: MOCK_SESSION_TOKEN,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString()
      }
      createSession.mockResolvedValueOnce(mockSessionData)

      // When: Authenticating with callback
      const result = await authenticateWithCallback(code, state)

      // Then: Returns session data directly
      expect(result).toEqual(mockSessionData)

      // And: OAuth flow is executed in correct order
      expect(validateStateParameter).toHaveBeenCalledWith(state)
      expect(retrievePkceVerifier).toHaveBeenCalledWith(state)
      expect(exchangeCodeForTokens).toHaveBeenCalledWith(
        code,
        MOCK_CODE_VERIFIER
      )
      expect(createSession).toHaveBeenCalled()
    })

    test('throws error with INVALID_STATE code when state validation fails', async () => {
      // Given: Invalid state parameter
      const code = MOCK_AUTH_CODE
      const state = 'invalid-state'

      // And: State validation fails
      validateStateParameter.mockResolvedValueOnce(false)

      // When/Then: Authentication throws error
      await expect(authenticateWithCallback(code, state)).rejects.toMatchObject(
        {
          message: 'State validation failed',
          code: 'INVALID_STATE'
        }
      )

      // And: Does not proceed with token exchange
      expect(exchangeCodeForTokens).not.toHaveBeenCalled()
      expect(createSession).not.toHaveBeenCalled()
    })

    test('throws error with MISSING_PKCE code when PKCE verifier cannot be retrieved', async () => {
      // Given: Valid state but missing PKCE verifier
      const code = MOCK_AUTH_CODE
      const state = MOCK_STATE

      // And: State validation passes
      validateStateParameter.mockResolvedValueOnce(true)

      // And: PKCE verifier retrieval returns null
      retrievePkceVerifier.mockResolvedValueOnce(null)

      // When/Then: Authentication throws error
      await expect(authenticateWithCallback(code, state)).rejects.toMatchObject(
        {
          message: 'PKCE verifier not found',
          code: 'MISSING_PKCE'
        }
      )

      // And: Does not proceed with token exchange
      expect(exchangeCodeForTokens).not.toHaveBeenCalled()
      expect(createSession).not.toHaveBeenCalled()
    })

    test('throws error when token exchange fails', async () => {
      // Given: Valid parameters but token exchange will fail
      const code = MOCK_AUTH_CODE
      const state = MOCK_STATE

      // And: Validation passes
      validateStateParameter.mockResolvedValueOnce(true)
      retrievePkceVerifier.mockResolvedValueOnce(MOCK_CODE_VERIFIER)

      // And: Token exchange fails
      exchangeCodeForTokens.mockRejectedValueOnce(
        new Error('Token exchange failed')
      )

      // When/Then: Authentication throws error
      await expect(authenticateWithCallback(code, state)).rejects.toThrow(
        'Token exchange failed'
      )

      // And: Session is not created
      expect(createSession).not.toHaveBeenCalled()
    })

    test('throws error when session creation fails', async () => {
      // Given: Valid parameters but session creation will fail
      const code = MOCK_AUTH_CODE
      const state = MOCK_STATE

      // And: Validation and token exchange pass
      validateStateParameter.mockResolvedValueOnce(true)
      retrievePkceVerifier.mockResolvedValueOnce(MOCK_CODE_VERIFIER)
      exchangeCodeForTokens.mockResolvedValueOnce({
        access_token: MOCK_ACCESS_TOKEN,
        refresh_token: MOCK_REFRESH_TOKEN
      })

      // And: Session creation fails
      createSession.mockRejectedValueOnce(new Error('Session creation failed'))

      // When/Then: Authentication throws error
      await expect(authenticateWithCallback(code, state)).rejects.toThrow(
        'Session creation failed'
      )
    })
  })

  describe('getSession', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test('retrieves session data from repository when session ID is provided', async () => {
      // Given: A session exists
      const mockSessionData = {
        session_id: MOCK_SESSION_ID,
        session_token: MOCK_SESSION_TOKEN,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString()
      }
      getSessionFromRepository.mockResolvedValueOnce(mockSessionData)

      // When: Getting the session
      const result = await getSessionFromId(MOCK_SESSION_ID)

      // Then: Returns session data from repository
      expect(result).toEqual(mockSessionData)
      expect(getSessionFromRepository).toHaveBeenCalledWith(MOCK_SESSION_ID)
    })

    test('returns null when session not found', async () => {
      // Given: Session does not exist
      const sessionId = 'non-existent-session'
      getSessionFromRepository.mockResolvedValueOnce(null)

      // When: Getting the session
      const result = await getSessionFromId(sessionId)

      // Then: Returns null
      expect(result).toBeNull()
      expect(getSessionFromRepository).toHaveBeenCalledWith(sessionId)
    })
  })
})
