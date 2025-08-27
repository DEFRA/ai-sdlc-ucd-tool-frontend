import { vi } from 'vitest'
import {
  createSession,
  getSession,
  deleteSession
} from './sessionRepository.js'

// Create a mock redis client that we can control
const mockRedisClient = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn()
}

vi.mock('../common/helpers/redis-client.js', () => ({
  buildRedisClient: vi.fn(() => mockRedisClient)
}))

vi.mock('../../config/config.js', () => ({
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

describe('sessionRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRedisClient.set.mockReset()
    mockRedisClient.get.mockReset()
    mockRedisClient.del.mockReset()
    mockRedisClient.set.mockResolvedValue('OK')
    mockRedisClient.del.mockResolvedValue(1)
  })

  describe('when creating a session', () => {
    it('creates session with valid structure and stores in Redis', async () => {
      // When: Creating a new session
      const result = await createSession()

      // Then: Session data has correct structure
      expect(result).toMatchObject({
        session_id: expect.any(String),
        session_token: expect.any(String),
        created_at: expect.any(String),
        expires_at: expect.any(String)
      })

      // And: Session is stored in Redis with correct TTL
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `session:${result.session_id}`,
        JSON.stringify(result),
        'EX',
        3600
      )
    })

    it('throws error when Redis storage fails', async () => {
      // Given: Redis set operation will fail
      mockRedisClient.set.mockRejectedValueOnce(
        new Error('Redis connection failed')
      )

      // When/Then: Creating session throws error
      await expect(createSession()).rejects.toThrow('Session creation failed')

      // And: Cleanup is attempted
      expect(mockRedisClient.del).toHaveBeenCalled()
    })
  })

  describe('when retrieving a session', () => {
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

  describe('when deleting a session', () => {
    it('deletes session from Redis', async () => {
      // Given: A session ID to delete
      const sessionId = 'session-to-delete'

      // When: Deleting the session
      await deleteSession(sessionId)

      // Then: Session is deleted from Redis
      expect(mockRedisClient.del).toHaveBeenCalledWith(`session:${sessionId}`)
    })

    it('handles null session ID gracefully', async () => {
      // When: Deleting with null ID
      await deleteSession(null)

      // Then: No Redis call is made
      expect(mockRedisClient.del).not.toHaveBeenCalled()
    })

    it('logs error when Redis deletion fails', async () => {
      // Given: Redis deletion will fail
      const sessionId = 'error-session-id'
      mockRedisClient.del.mockRejectedValueOnce(
        new Error('Redis deletion failed')
      )

      // Spy on console.error to verify error logging
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      // When: Deleting session with Redis error
      await deleteSession(sessionId)

      // Then: Error is logged but function doesn't throw
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error deleting session:',
        expect.any(Error)
      )

      // Clean up spy
      consoleErrorSpy.mockRestore()
    })
  })
})
