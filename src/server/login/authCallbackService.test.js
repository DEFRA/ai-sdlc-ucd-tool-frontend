import { vi } from 'vitest'
import { processAuthCallback, getSession } from './authCallbackService.js'
import {
  validateStateParameter,
  retrievePkceVerifier
} from '../authentication/oauth-state-storage.js'
import { exchangeCodeForTokens } from '../authentication/azure-ad-token-client.js'

// Mock dependencies
vi.mock('../authentication/oauth-state-storage.js', () => ({
  validateStateParameter: vi.fn(),
  retrievePkceVerifier: vi.fn()
}))

vi.mock('../authentication/azure-ad-token-client.js', () => ({
  exchangeCodeForTokens: vi.fn()
}))

// Create a mock redis client that we can control
const mockRedisClient = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn()
}

vi.mock('../common/helpers/redis-client.js', () => ({
  buildRedisClient: vi.fn(() => mockRedisClient)
}))

vi.mock('../../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const configMap = {
        redis: { host: 'localhost', port: 6379 },
        'session.cache.ttl': 3600000,
        'auth.jwtSecret': 'test-secret'
      }
      return configMap[key]
    })
  }
}))

describe('authCallbackService', () => {
  describe('when processing OAuth callback', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      // Reset the Redis mock for each test
      mockRedisClient.set.mockReset()
      mockRedisClient.get.mockReset()
      mockRedisClient.del.mockReset()
      mockRedisClient.set.mockResolvedValue('OK')
      mockRedisClient.del.mockResolvedValue(1)
    })

    it('successfully processes valid authentication callback with correct state and PKCE', async () => {
      // Given: Valid OAuth callback parameters
      const code = 'valid-auth-code'
      const state = 'valid-state'

      // And: State validation passes
      vi.mocked(validateStateParameter).mockResolvedValueOnce(true)

      // And: PKCE verifier is retrieved successfully
      vi.mocked(retrievePkceVerifier).mockResolvedValueOnce('mock-verifier')

      // And: Token exchange succeeds
      vi.mocked(exchangeCodeForTokens).mockResolvedValueOnce({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token'
      })

      // When: Processing the callback
      const result = await processAuthCallback(code, state)

      // Then: Authentication succeeds with session data
      expect(result.success).toBe(true)
      expect(result.sessionData).toMatchObject({
        session_id: expect.any(String),
        session_token: expect.any(String),
        created_at: expect.any(String),
        expires_at: expect.any(String)
      })

      // And: OAuth flow is executed in correct order
      expect(validateStateParameter).toHaveBeenCalledWith(state)
      expect(retrievePkceVerifier).toHaveBeenCalledWith(state)
      expect(exchangeCodeForTokens).toHaveBeenCalledWith(code, 'mock-verifier')

      // And: Session is stored in Redis
      expect(mockRedisClient.set).toHaveBeenCalled()
    })

    it('returns error when state validation fails', async () => {
      // Given: Invalid state parameter
      const code = 'auth-code'
      const state = 'invalid-state'

      // And: State validation fails
      vi.mocked(validateStateParameter).mockResolvedValueOnce(false)

      // When: Processing the callback
      const result = await processAuthCallback(code, state)

      // Then: Returns failure with appropriate error
      expect(result).toEqual({
        success: false,
        error: 'INVALID_STATE',
        message: 'State validation failed'
      })

      // And: Does not proceed with token exchange
      expect(exchangeCodeForTokens).not.toHaveBeenCalled()
    })

    it('returns error when PKCE verifier cannot be retrieved', async () => {
      // Given: Valid state but missing PKCE verifier
      const code = 'auth-code'
      const state = 'valid-state'

      // And: State validation passes
      vi.mocked(validateStateParameter).mockResolvedValueOnce(true)

      // And: PKCE verifier retrieval returns null
      vi.mocked(retrievePkceVerifier).mockResolvedValueOnce(null)

      // When: Processing the callback
      const result = await processAuthCallback(code, state)

      // Then: Returns failure with appropriate error
      expect(result).toEqual({
        success: false,
        error: 'MISSING_PKCE',
        message: 'PKCE verifier not found'
      })

      // And: Does not proceed with token exchange
      expect(exchangeCodeForTokens).not.toHaveBeenCalled()
    })

    it('throws error when token exchange fails', async () => {
      // Given: Valid parameters but token exchange will fail
      const code = 'auth-code'
      const state = 'valid-state'

      // And: Validation passes
      vi.mocked(validateStateParameter).mockResolvedValueOnce(true)
      vi.mocked(retrievePkceVerifier).mockResolvedValueOnce('mock-verifier')

      // And: Token exchange fails
      vi.mocked(exchangeCodeForTokens).mockRejectedValueOnce(
        new Error('Token exchange failed')
      )

      // When/Then: Processing the callback throws error
      await expect(processAuthCallback(code, state)).rejects.toThrow(
        'Token exchange failed'
      )
    })
  })

  describe('getSession', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      mockRedisClient.get.mockReset()
      mockRedisClient.del.mockReset()
    })

    it('retrieves valid session from Redis', async () => {
      // Given: A valid session exists in Redis
      const sessionId = 'valid-session-id'
      const sessionData = {
        session_id: sessionId,
        session_token: 'valid-token',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString()
      }
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(sessionData))

      // When: Getting the session
      const result = await getSession(sessionId)

      // Then: Session data is returned
      expect(result).toEqual(sessionData)
      expect(mockRedisClient.get).toHaveBeenCalledWith(`session:${sessionId}`)
    })

    it('returns null when session does not exist', async () => {
      // Given: Session does not exist in Redis
      mockRedisClient.get.mockResolvedValueOnce(null)

      // When: Getting a non-existent session
      const result = await getSession('non-existent-session')

      // Then: Null is returned
      expect(result).toBeNull()
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        'session:non-existent-session'
      )
    })

    it('returns null when sessionId is not provided', async () => {
      // When: Getting session without ID
      const result = await getSession(null)

      // Then: Null is returned without Redis call
      expect(result).toBeNull()
      expect(mockRedisClient.get).not.toHaveBeenCalled()
    })

    it('returns null and cleans up expired session', async () => {
      // Given: An expired session exists in Redis
      const sessionId = 'expired-session-id'
      const expiredSessionData = {
        session_id: sessionId,
        session_token: 'expired-token',
        created_at: new Date(Date.now() - 7200000).toISOString(),
        expires_at: new Date(Date.now() - 3600000).toISOString() // Expired 1 hour ago
      }
      mockRedisClient.get.mockResolvedValueOnce(
        JSON.stringify(expiredSessionData)
      )
      mockRedisClient.del.mockResolvedValueOnce(1)

      // When: Getting an expired session
      const result = await getSession(sessionId)

      // Then: Null is returned and session is deleted
      expect(result).toBeNull()
      expect(mockRedisClient.del).toHaveBeenCalledWith(`session:${sessionId}`)
    })

    it('returns null when Redis throws error', async () => {
      // Given: Redis throws an error
      const sessionId = 'error-session-id'
      mockRedisClient.get.mockRejectedValueOnce(
        new Error('Redis connection failed')
      )

      // Spy on console.error to verify error logging
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      // When: Getting session with Redis error
      const result = await getSession(sessionId)

      // Then: Null is returned and error is logged
      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error retrieving session:',
        expect.any(Error)
      )

      // Clean up spy
      consoleErrorSpy.mockRestore()
    })

    it('handles malformed JSON in session data', async () => {
      // Given: Malformed JSON in Redis
      const sessionId = 'malformed-session-id'
      mockRedisClient.get.mockResolvedValueOnce('invalid-json{')

      // Spy on console.error to verify error logging
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      // When: Getting session with malformed data
      const result = await getSession(sessionId)

      // Then: Null is returned and error is logged
      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error retrieving session:',
        expect.any(Error)
      )

      // Clean up spy
      consoleErrorSpy.mockRestore()
    })
  })
})
