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

  // Helper functions to reduce repetition
  const createSession = () =>
    import('./session-manager.js').then((m) => m.createSession)
  const getSession = () =>
    import('./session-manager.js').then((m) => m.getSession)
  const deleteSession = () =>
    import('./session-manager.js').then((m) => m.deleteSession)

  const setupRedisSuccess = () =>
    mockRedisClient.set.mockResolvedValueOnce('OK')
  const setupRedisFailure = (error = new Error('Redis connection failed')) => {
    mockRedisClient.set.mockRejectedValueOnce(error)
  }

  const createMockSession = (overrides = {}) => ({
    session_id: 'test-session',
    session_token: 'test-token',
    created_at: TEST_DATE_ISO,
    expires_at: EXPIRES_DATE_ISO,
    ...overrides
  })

  const expectSessionData = () => ({
    session_id: MOCK_SESSION_ID,
    session_token: MOCK_JWT_TOKEN,
    created_at: TEST_DATE_ISO,
    expires_at: EXPIRES_DATE_ISO
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest = {}
    mockH = {
      state: vi.fn(),
      unstate: vi.fn()
    }
    vi.mocked(jwt.sign).mockReturnValue(MOCK_JWT_TOKEN)
    vi.useFakeTimers()
    vi.setSystemTime(TEST_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('createSession', () => {
    test('Should create unique session ID', async () => {
      setupRedisSuccess()
      const result = await (await createSession())(mockRequest, mockH)
      expect(result.session_id).toBe(MOCK_SESSION_ID)
    })

    test('Should generate valid JWT token with correct payload', async () => {
      setupRedisSuccess()
      await (
        await createSession()
      )(mockRequest, mockH)

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
      setupRedisSuccess()
      await (
        await createSession()
      )(mockRequest, mockH)

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `session:${MOCK_SESSION_ID}`,
        JSON.stringify(expectSessionData()),
        'EX',
        SESSION_TTL_SECONDS
      )
    })

    test('Should set secure HTTP-only cookie', async () => {
      setupRedisSuccess()
      await (
        await createSession()
      )(mockRequest, mockH)

      expect(mockH.state).toHaveBeenCalledWith('session', MOCK_SESSION_ID, {
        ttl: SESSION_TTL_MS,
        isSecure: true,
        isHttpOnly: true,
        isSameSite: 'Lax',
        path: '/',
        password: MOCK_COOKIE_PASSWORD,
        encoding: 'iron'
      })
    })

    test('Should return session data object with all required fields', async () => {
      setupRedisSuccess()
      const result = await (await createSession())(mockRequest, mockH)
      expect(result).toEqual(expectSessionData())
    })

    test.each([
      ['Redis connection failed', true],
      ['Redis connection failed with cleanup failure', false]
    ])('Should handle Redis failures: %s', async (_, cleanupSucceeds) => {
      setupRedisFailure()
      if (cleanupSucceeds) {
        mockRedisClient.del.mockResolvedValueOnce(1)
      } else {
        mockRedisClient.del.mockRejectedValueOnce(new Error('Cleanup failed'))
      }

      await expect((await createSession())(mockRequest, mockH)).rejects.toThrow(
        'Session creation failed'
      )
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `session:${MOCK_SESSION_ID}`
      )
    })
  })

  describe('getSession', () => {
    test('Should retrieve session from Redis with correct key', async () => {
      const sessionData = createMockSession({ session_id: 'test-session-id' })
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(sessionData))

      const result = await (await getSession())('test-session-id')

      expect(mockRedisClient.get).toHaveBeenCalledWith(
        'session:test-session-id'
      )
      expect(result).toEqual(sessionData)
    })

    test.each([
      ['null', null],
      ['undefined', undefined],
      ['empty string', '']
    ])('Should return null when sessionId is %s', async (_, sessionId) => {
      const result = await (await getSession())(sessionId)
      expect(result).toBeNull()
      expect(mockRedisClient.get).not.toHaveBeenCalled()
    })

    test.each([
      ['non-existent session', null],
      ['invalid JSON', 'invalid-json-data'],
      ['Redis error', new Error('Redis get failed')]
    ])('Should return null for %s', async (_, mockValue) => {
      if (mockValue instanceof Error) {
        mockRedisClient.get.mockRejectedValueOnce(mockValue)
      } else {
        mockRedisClient.get.mockResolvedValueOnce(mockValue)
      }

      const result = await (await getSession())('test-session')
      expect(result).toBeNull()
    })

    test.each([
      ['expired 1 hour ago', -3600000, null],
      ['expires exactly now', 0, null],
      ['expires 1ms in future', 1, 'session'],
      ['expires 1 hour in future', 3600000, 'session']
    ])(
      'Should handle session expiry: %s',
      async (_, timeOffset, expectedResult) => {
        const sessionData = createMockSession({
          expires_at: new Date(TEST_DATE.getTime() + timeOffset).toISOString()
        })
        mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(sessionData))

        const result = await (await getSession())('test-session')

        if (expectedResult === 'session') {
          expect(result).toEqual(sessionData)
        } else {
          expect(result).toBeNull()
        }
      }
    )

    test.each([
      [
        'missing expires_at field',
        {
          session_id: 'malformed-session',
          session_token: 'malformed-token',
          created_at: TEST_DATE_ISO
        }
      ],
      [
        'invalid expires_at format',
        createMockSession({ expires_at: 'not-a-valid-date' })
      ]
    ])(
      'Should handle malformed session data: %s',
      async (testName, sessionData) => {
        mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(sessionData))

        const result = await (await getSession())('test-session')
        expect(result).toBeNull()
      }
    )
  })

  describe('deleteSession', () => {
    test('Should remove session from Redis with correct key', async () => {
      mockRedisClient.del.mockResolvedValueOnce(1)
      const result = await (await deleteSession())('delete-session-id')

      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'session:delete-session-id'
      )
      expect(result).toBe(1)
    })

    test.each([
      ['with h provided', true, true],
      ['without h provided', false, false]
    ])(
      'Should handle cookie clearing %s',
      async (_, provideH, expectUnstate) => {
        mockRedisClient.del.mockResolvedValueOnce(1)
        await (
          await deleteSession()
        )('test-session', provideH ? mockH : null)

        if (expectUnstate) {
          expect(mockH.unstate).toHaveBeenCalledWith('session')
        } else {
          expect(mockH.unstate).not.toHaveBeenCalled()
        }
      }
    )

    test.each([
      ['Redis deletion succeeds', 1],
      ['Session does not exist', 0]
    ])('Should return deletion count: %s', async (_, deleteCount) => {
      mockRedisClient.del.mockResolvedValueOnce(deleteCount)
      const result = await (await deleteSession())('test-session')
      expect(result).toBe(deleteCount)
    })

    test('Should handle Redis deletion failures but still clear cookie', async () => {
      const redisError = new Error('Redis delete failed')
      mockRedisClient.del.mockRejectedValueOnce(redisError)

      await expect(
        (await deleteSession())('failing-session', mockH)
      ).rejects.toThrow('Redis delete failed')
      expect(mockH.unstate).toHaveBeenCalledWith('session')
    })
  })
})
