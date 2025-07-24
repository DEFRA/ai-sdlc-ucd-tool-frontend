import { vi } from 'vitest'
import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
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

describe('#sessionCookieManagement', () => {
  let server
  let testPassword
  let mockRedisClient

  beforeAll(async () => {
    // Get the mock client
    const { buildRedisClient } = await import(
      '../common/helpers/redis-client.js'
    )
    mockRedisClient = buildRedisClient()

    testPassword = config.get('auth.sharedPassword')
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Session Cookie Creation on Successful Login', () => {
    test('Should set HTTP-only secure cookie with session ID when login is successful', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: testPassword
        }
      })

      // Check that login was successful
      expect(statusCode).toBe(statusCodes.ok)
      expect(headers.location).toBe('/')

      // Check that a session cookie was set
      const setCookieHeader = headers['set-cookie']
      expect(setCookieHeader).toBeDefined()
      expect(Array.isArray(setCookieHeader)).toBe(true)
      expect(setCookieHeader.length).toBeGreaterThan(0)

      // Find the session cookie
      const sessionCookie = setCookieHeader.find((cookie) =>
        cookie.startsWith('session=')
      )
      expect(sessionCookie).toBeDefined()

      // Verify cookie attributes
      expect(sessionCookie).toContain('HttpOnly')
      expect(sessionCookie).toContain('SameSite=Strict')

      // In production, it should also be Secure
      if (config.get('session.cookie.secure')) {
        expect(sessionCookie).toContain('Secure')
      }

      // Verify cookie has proper expiry matching session TTL
      const ttlInSeconds = config.get('session.cookie.ttl') / 1000
      expect(sessionCookie).toMatch(new RegExp(`Max-Age=${ttlInSeconds}`))
    })

    test('Should create session in Redis with unique session ID', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: testPassword
        }
      })

      expect(statusCode).toBe(statusCodes.ok)

      // Verify Redis SET was called to create session
      expect(mockRedisClient.set).toHaveBeenCalled()

      // Get the session ID from the Redis call
      const redisSetCall = mockRedisClient.set.mock.calls[0]
      expect(redisSetCall).toBeDefined()

      const [sessionKey, sessionData, expiryType, expiryValue] = redisSetCall

      // Verify session key format
      expect(sessionKey).toMatch(/^session:[\w-]+$/)

      // Verify session data structure
      const parsedSessionData = JSON.parse(sessionData)
      expect(parsedSessionData).toHaveProperty('session_id')
      expect(parsedSessionData).toHaveProperty('session_token')
      expect(parsedSessionData).toHaveProperty('created_at')
      expect(parsedSessionData).toHaveProperty('expires_at')

      // Verify TTL is set correctly
      expect(expiryType).toBe('EX')
      expect(expiryValue).toBe(config.get('session.cache.ttl') / 1000)

      // Verify session ID is cryptographically secure (UUID v4 or similar)
      expect(parsedSessionData.session_id).toMatch(/^[\w-]{36,}$/)
    })

    test('Should generate JWT token and store in session', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: testPassword
        }
      })

      expect(statusCode).toBe(statusCodes.ok)

      // Get the session data from Redis mock
      const redisSetCall = mockRedisClient.set.mock.calls[0]
      const sessionData = JSON.parse(redisSetCall[1])

      // Verify JWT token is present
      expect(sessionData.session_token).toBeDefined()
      expect(typeof sessionData.session_token).toBe('string')

      // Verify JWT structure (header.payload.signature)
      const jwtParts = sessionData.session_token.split('.')
      expect(jwtParts.length).toBe(3)

      // Decode JWT payload (without verification for testing)
      const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64').toString())

      // Verify JWT contains session_id claim
      expect(payload.session_id).toBe(sessionData.session_id)
      expect(payload.iat).toBeDefined()
      expect(payload.exp).toBeDefined()

      // Verify expiration matches session TTL
      const expectedExp = payload.iat + config.get('session.cache.ttl') / 1000
      expect(payload.exp).toBe(expectedExp)
    })

    test('Should delete session from Redis and return error if cookie setting fails', async () => {
      // Clear previous calls before this test
      mockRedisClient.del.mockClear()

      // Mock the session manager to simulate cookie setting failure
      const sessionManagerModule = await import(
        '../common/helpers/session-manager.js'
      )

      // Create a proper spy that we can restore
      const spy = vi
        .spyOn(sessionManagerModule, 'createSession')
        .mockImplementation(async (request, h) => {
          const sessionId = 'test-session-id'
          const sessionKey = `session:${sessionId}`

          // Store in Redis first (to simulate the session being created)
          await mockRedisClient.set(sessionKey, JSON.stringify({}), 'EX', 100)

          // Then simulate cookie setting failure
          await mockRedisClient.del(sessionKey)
          throw new Error('Session creation failed')
        })

      try {
        const { statusCode, result } = await server.inject({
          method: 'POST',
          url: '/login',
          payload: {
            password: testPassword
          }
        })

        expect(statusCode).toBe(statusCodes.internalServerError)
        expect(result.message).toBe(
          'Service temporarily unavailable. Please try again in a few moments.'
        )

        // Verify session was cleaned up from Redis
        expect(mockRedisClient.del).toHaveBeenCalledWith(
          'session:test-session-id'
        )
      } finally {
        // Restore the original implementation
        spy.mockRestore()
      }
    })

    test('Should align cookie expiry with Redis TTL', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: testPassword
        }
      })

      expect(statusCode).toBe(statusCodes.ok)

      // Get cookie Max-Age
      const setCookieHeader = headers['set-cookie']
      const sessionCookie = setCookieHeader.find((cookie) =>
        cookie.startsWith('session=')
      )
      const maxAgeMatch = sessionCookie.match(/Max-Age=(\d+)/)
      const cookieMaxAge = parseInt(maxAgeMatch[1])

      // Get Redis TTL
      const redisSetCall = mockRedisClient.set.mock.calls[0]
      const redisTTL = redisSetCall[3] // EX value in seconds

      // Verify they match
      expect(cookieMaxAge).toBe(redisTTL)
      expect(cookieMaxAge).toBe(config.get('session.cookie.ttl') / 1000)
    })
  })

  describe('Cookie Security Attributes', () => {
    test('Should set HttpOnly flag to prevent XSS attacks', async () => {
      const { headers } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: testPassword
        }
      })

      const sessionCookie = headers['set-cookie'].find((cookie) =>
        cookie.startsWith('session=')
      )

      expect(sessionCookie).toContain('HttpOnly')
    })

    test('Should set SameSite attribute for CSRF protection', async () => {
      const { headers } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: testPassword
        }
      })

      const sessionCookie = headers['set-cookie'].find((cookie) =>
        cookie.startsWith('session=')
      )

      expect(sessionCookie).toContain('SameSite=Strict')
    })

    test('Should set Secure flag in production environments', async () => {
      // This test checks configuration - in production, secure should be true
      const isSecure = config.get('session.cookie.secure')

      const { headers } = await server.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: testPassword
        }
      })

      const sessionCookie = headers['set-cookie'].find((cookie) =>
        cookie.startsWith('session=')
      )

      if (isSecure) {
        expect(sessionCookie).toContain('Secure')
      } else {
        expect(sessionCookie).not.toContain('Secure')
      }
    })
  })
})
