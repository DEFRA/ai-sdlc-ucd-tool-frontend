import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import jwt from 'jsonwebtoken'

import { createAuthenticatedSession } from './session-creation-service.js'
import { config } from '../../config/config.js'
import { redisClient } from '../common/helpers/redis-client.js'

// Mock Redis client
vi.mock('../common/helpers/redis-client.js', () => ({
  redisClient: {
    setEx: vi.fn(),
    get: vi.fn()
  }
}))

vi.mock('jsonwebtoken')
vi.mock('crypto', () => ({
  randomBytes: vi.fn()
}))

describe('Session Creation Service', () => {
  let jwtSecret
  let sessionTtl

  beforeAll(() => {
    // Use environment-specific configuration (test.json provides defaults)
    jwtSecret = config.get('auth.jwtSecret')
    sessionTtl = config.get('auth.session.ttl')
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createAuthenticatedSession', () => {
    test('should create complete session with secure ID, JWT token, and Redis storage', async () => {
      // Arrange
      const mockJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token'
      const mockTimestamp = new Date('2024-01-15T10:00:00Z')
      const mockSessionBytes = Buffer.from('secure-session-123')
      const mockSessionId = mockSessionBytes.toString('hex')

      const crypto = await import('crypto')
      crypto.randomBytes.mockReturnValue(mockSessionBytes)
      jwt.sign.mockReturnValue(mockJwtToken)
      redisClient.setEx.mockResolvedValue('OK')
      vi.setSystemTime(mockTimestamp)

      // Act
      const result = await createAuthenticatedSession()

      // Assert - Verify secure session ID generation
      expect(crypto.randomBytes).toHaveBeenCalledWith(32)
      expect(crypto.randomBytes).toHaveBeenCalledTimes(1)

      // Assert - Verify JWT token creation with correct claims
      const expectedIat = Math.floor(mockTimestamp.getTime() / 1000)
      const expectedExp = expectedIat + sessionTtl
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          session_id: mockSessionId,
          iat: expectedIat,
          exp: expectedExp
        },
        jwtSecret,
        { algorithm: 'HS256' }
      )

      // Assert - Verify Redis storage with atomic expiry and complete session data
      const expectedSessionData = {
        session_id: mockSessionId,
        session_token: mockJwtToken,
        created_at: mockTimestamp.toISOString(),
        expires_at: new Date(
          mockTimestamp.getTime() + sessionTtl * 1000
        ).toISOString()
      }
      expect(redisClient.setEx).toHaveBeenCalledWith(
        `session:${mockSessionId}`,
        sessionTtl,
        JSON.stringify(expectedSessionData)
      )

      // Assert - Verify successful response
      expect(result).toEqual({
        sessionId: mockSessionId,
        sessionToken: mockJwtToken,
        success: true
      })
    })

    test('should handle Redis failures gracefully without partial data', async () => {
      // Arrange
      const crypto = await import('crypto')
      crypto.randomBytes.mockReturnValue(Buffer.from('session-id'))
      jwt.sign.mockReturnValue('jwt-token')
      redisClient.setEx.mockRejectedValue(new Error('Redis connection failed'))

      // Act
      const result = await createAuthenticatedSession()

      // Assert - Verify error response without exposing internals
      expect(result).toEqual({
        success: false,
        error:
          'Service temporarily unavailable. Please try again in a few moments.'
      })

      // Assert - Verify no partial data in response
      expect(result.sessionId).toBeUndefined()
      expect(result.sessionToken).toBeUndefined()
    })
  })
})
