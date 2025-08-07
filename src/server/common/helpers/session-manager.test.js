import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import jwt from 'jsonwebtoken'

// Test constants for clarity and correlation
const TEST_DATE = new Date('2024-01-01T00:00:00Z')
const TEST_DATE_ISO = '2024-01-01T00:00:00.000Z'
const TEST_DATE_UNIX_SECONDS = 1704067200 // Unix timestamp in seconds for TEST_DATE
const SESSION_TTL_MS = 3600000 // 1 hour in milliseconds
const SESSION_TTL_SECONDS = 3600 // 1 hour in seconds
const EXPIRES_DATE_ISO = '2024-01-01T01:00:00.000Z' // TEST_DATE + 1 hour
const MOCK_SESSION_ID = 'mock-session-id-123'
const MOCK_JWT_TOKEN = 'mock-jwt-token'
const MOCK_JWT_SECRET = 'mock-jwt-secret'
const MOCK_COOKIE_PASSWORD = 'mock-cookie-password'

// Mock dependencies with proper default exports
vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(() => MOCK_SESSION_ID)
  },
  randomUUID: vi.fn(() => MOCK_SESSION_ID)
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn()
  },
  sign: vi.fn()
}))

const mockRedisClient = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn()
}

vi.mock('../../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const config = {
        'session.cache.ttl': SESSION_TTL_MS,
        'auth.jwtSecret': MOCK_JWT_SECRET,
        'session.cookie.ttl': SESSION_TTL_MS,
        'session.cookie.secure': true,
        'session.cookie.password': MOCK_COOKIE_PASSWORD,
        redis: { host: 'localhost', port: 6379 }
      }
      return config[key]
    })
  }
}))

vi.mock('./redis-client.js', () => ({
  buildRedisClient: vi.fn(() => mockRedisClient)
}))

describe('session-manager', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock request object (minimal, not testing HAPI)
    mockRequest = {}

    // Mock response toolkit (h) - only the methods we use
    mockH = {
      state: vi.fn(),
      unstate: vi.fn()
    }

    // Mock JWT sign to return predictable token
    vi.mocked(jwt.sign).mockReturnValue(MOCK_JWT_TOKEN)

    // Mock Date.now for consistent timestamps
    vi.useFakeTimers()
    vi.setSystemTime(TEST_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('createSession', () => {
    test('Should create unique session ID', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK')

      const { createSession } = await import('./session-manager.js')
      const result = await createSession(mockRequest, mockH)

      expect(result.session_id).toBe(MOCK_SESSION_ID)
    })

    test('Should generate valid JWT token with correct payload', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK')

      const { createSession } = await import('./session-manager.js')
      await createSession(mockRequest, mockH)

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          session_id: MOCK_SESSION_ID,
          iat: TEST_DATE_UNIX_SECONDS
        },
        MOCK_JWT_SECRET,
        { expiresIn: SESSION_TTL_SECONDS }
      )
    })

    test('Should store session in Redis with correct TTL', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK')

      const { createSession } = await import('./session-manager.js')
      await createSession(mockRequest, mockH)

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `session:${MOCK_SESSION_ID}`,
        JSON.stringify({
          session_id: MOCK_SESSION_ID,
          session_token: MOCK_JWT_TOKEN,
          created_at: TEST_DATE_ISO,
          expires_at: EXPIRES_DATE_ISO
        }),
        'EX',
        SESSION_TTL_SECONDS
      )
    })

    test('Should set secure HTTP-only cookie', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK')

      const { createSession } = await import('./session-manager.js')
      await createSession(mockRequest, mockH)

      expect(mockH.state).toHaveBeenCalledWith('session', MOCK_SESSION_ID, {
        ttl: SESSION_TTL_MS,
        isSecure: true,
        isHttpOnly: true,
        isSameSite: 'Strict',
        path: '/',
        password: MOCK_COOKIE_PASSWORD,
        encoding: 'iron'
      })
    })

    test('Should return session data object with all required fields', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK')

      const { createSession } = await import('./session-manager.js')
      const result = await createSession(mockRequest, mockH)

      expect(result).toEqual({
        session_id: MOCK_SESSION_ID,
        session_token: MOCK_JWT_TOKEN,
        created_at: TEST_DATE_ISO,
        expires_at: EXPIRES_DATE_ISO
      })
    })

    test('Should handle Redis connection failures', async () => {
      const redisError = new Error('Redis connection failed')
      mockRedisClient.set.mockRejectedValueOnce(redisError)
      mockRedisClient.del.mockResolvedValueOnce(1)

      const { createSession } = await import('./session-manager.js')

      await expect(createSession(mockRequest, mockH)).rejects.toThrow(
        'Session creation failed'
      )

      // Should attempt cleanup
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `session:${MOCK_SESSION_ID}`
      )
    })

    test('Should ignore cleanup errors when Redis storage fails', async () => {
      const redisError = new Error('Redis connection failed')
      mockRedisClient.set.mockRejectedValueOnce(redisError)
      mockRedisClient.del.mockRejectedValueOnce(new Error('Cleanup failed'))

      const { createSession } = await import('./session-manager.js')

      await expect(createSession(mockRequest, mockH)).rejects.toThrow(
        'Session creation failed'
      )

      // Should still attempt cleanup even if it fails
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `session:${MOCK_SESSION_ID}`
      )
    })
  })

  describe('getSession', () => {
    test('Should retrieve session from Redis with correct key', async () => {
      const mockSessionData = {
        session_id: 'test-session-id',
        session_token: 'test-token',
        created_at: TEST_DATE_ISO,
        expires_at: EXPIRES_DATE_ISO
      }
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(mockSessionData))

      const { getSession } = await import('./session-manager.js')
      const result = await getSession('test-session-id')

      expect(mockRedisClient.get).toHaveBeenCalledWith(
        'session:test-session-id'
      )
      expect(result).toEqual(mockSessionData)
    })

    test('Should return null for non-existent sessions', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null)

      const { getSession } = await import('./session-manager.js')
      const result = await getSession('non-existent-session')

      expect(result).toBeNull()
    })

    test('Should parse JSON session data correctly', async () => {
      const mockSessionData = {
        session_id: 'parsed-session',
        session_token: 'parsed-token',
        created_at: TEST_DATE_ISO,
        expires_at: EXPIRES_DATE_ISO
      }
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(mockSessionData))

      const { getSession } = await import('./session-manager.js')
      const result = await getSession('parsed-session')

      expect(result).toEqual(mockSessionData)
      expect(typeof result).toBe('object')
      expect(result.session_id).toBe('parsed-session')
    })

    test('Should handle Redis errors gracefully', async () => {
      const redisError = new Error('Redis get failed')
      mockRedisClient.get.mockRejectedValueOnce(redisError)

      const { getSession } = await import('./session-manager.js')

      await expect(getSession('error-session')).rejects.toThrow(
        'Redis get failed'
      )
    })
  })

  describe('deleteSession', () => {
    test('Should remove session from Redis with correct key', async () => {
      mockRedisClient.del.mockResolvedValueOnce(1)

      const { deleteSession } = await import('./session-manager.js')
      const result = await deleteSession('delete-session-id')

      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'session:delete-session-id'
      )
      expect(result).toBe(1)
    })

    test('Should clear session cookie when h is provided', async () => {
      mockRedisClient.del.mockResolvedValueOnce(1)

      const { deleteSession } = await import('./session-manager.js')
      await deleteSession('session-with-cookie', mockH)

      expect(mockH.unstate).toHaveBeenCalledWith('session')
    })

    test('Should not clear cookie when h is not provided', async () => {
      mockRedisClient.del.mockResolvedValueOnce(1)

      const { deleteSession } = await import('./session-manager.js')
      await deleteSession('session-without-cookie')

      expect(mockH.unstate).not.toHaveBeenCalled()
    })

    test('Should handle Redis deletion failures gracefully', async () => {
      const redisError = new Error('Redis delete failed')
      mockRedisClient.del.mockRejectedValueOnce(redisError)

      const { deleteSession } = await import('./session-manager.js')

      await expect(deleteSession('failing-session', mockH)).rejects.toThrow(
        'Redis delete failed'
      )
    })

    test('Should still clear cookie even if Redis deletion fails', async () => {
      const redisError = new Error('Redis delete failed')
      mockRedisClient.del.mockRejectedValueOnce(redisError)

      const { deleteSession } = await import('./session-manager.js')

      await expect(deleteSession('failing-session', mockH)).rejects.toThrow(
        'Redis delete failed'
      )

      // Cookie should still be cleared despite Redis failure
      expect(mockH.unstate).toHaveBeenCalledWith('session')
    })

    test('Should return number of deleted keys on success', async () => {
      mockRedisClient.del.mockResolvedValueOnce(1)

      const { deleteSession } = await import('./session-manager.js')
      const result = await deleteSession('successful-delete')

      expect(result).toBe(1)
    })

    test('Should handle case when session does not exist in Redis', async () => {
      mockRedisClient.del.mockResolvedValueOnce(0) // 0 keys deleted

      const { deleteSession } = await import('./session-manager.js')
      const result = await deleteSession('non-existent-session')

      expect(result).toBe(0)
    })
  })
})
