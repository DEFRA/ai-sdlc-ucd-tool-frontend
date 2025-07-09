import { vi, describe, test, expect, beforeEach } from 'vitest'
import { SessionStore } from './session-store.js'
import {
  createMockRedisClient,
  createMockLogger,
  createValidSessionData,
  createInvalidSessionData,
  createOversizedSessionData,
  setupRedisSuccess,
  setupRedisError,
  setupRedisConnectionError,
  sessionStoreConfig,
  generateTestSessionId,
  cleanupMocks
} from '../test-helpers/session-store-test-helpers.js'

const mockRedisClient = createMockRedisClient()
const mockLogger = createMockLogger()

vi.mock('./redis-client.js', () => ({
  buildRedisClient: vi.fn(() => mockRedisClient)
}))

vi.mock('./logging/logger.js', () => ({
  createLogger: vi.fn(() => mockLogger)
}))

vi.mock('../../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'session.cache.ttl') return sessionStoreConfig.sessionTtl
      if (key === 'redis') return sessionStoreConfig.defaultRedisConfig
      return null
    })
  }
}))

describe('SessionStore', () => {
  let sessionStore
  let validSessionData

  beforeEach(() => {
    sessionStore = new SessionStore()
    validSessionData = createValidSessionData()
    cleanupMocks()
    mockRedisClient.status = 'ready'
  })

  describe('Connection Management', () => {
    test('should successfully connect to Redis', async () => {
      const result = await sessionStore.connect()
      expect(result).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Connected to Redis session store'
      )
    })

    test('should handle Redis connection errors', async () => {
      setupRedisConnectionError(mockRedisClient)

      await expect(sessionStore.connect()).rejects.toThrow('Connection failed')
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Redis connection error: Connection failed'
      )
    })

    test('should successfully disconnect from Redis', async () => {
      await sessionStore.connect()
      const result = await sessionStore.disconnect()
      expect(result).toBe(true)
      expect(mockRedisClient.quit).toHaveBeenCalled()
    })
  })

  describe('Session Creation', () => {
    beforeEach(async () => {
      await sessionStore.connect()
    })

    test('should create a new session with valid data', async () => {
      setupRedisSuccess(mockRedisClient)
      const sessionId = generateTestSessionId()

      const result = await sessionStore.createSession(
        sessionId,
        validSessionData
      )

      expect(result).toBe(true)
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `session:${sessionId}`,
        14400,
        JSON.stringify(validSessionData)
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Session created: ${sessionId}`
      )
    })

    test('should handle Redis errors during session creation', async () => {
      setupRedisError(mockRedisClient, 'Redis error')
      const sessionId = generateTestSessionId()

      await expect(
        sessionStore.createSession(sessionId, validSessionData)
      ).rejects.toThrow('Redis error')
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error creating session ${sessionId}: Redis error`
      )
    })

    test('should validate session data structure', async () => {
      const sessionId = generateTestSessionId()

      await expect(
        sessionStore.createSession(
          sessionId,
          createInvalidSessionData.missingUserId
        )
      ).rejects.toThrow('Invalid session data: missing required fields')
    })

    test('should handle session data exceeding size limits', async () => {
      const sessionId = generateTestSessionId()
      const oversizedData = createOversizedSessionData()

      await expect(
        sessionStore.createSession(sessionId, oversizedData)
      ).rejects.toThrow('Session data exceeds maximum size limit')
    })
  })

  describe('Session Retrieval', () => {
    beforeEach(async () => {
      await sessionStore.connect()
    })

    test('should retrieve existing session data', async () => {
      const sessionId = generateTestSessionId()
      mockRedisClient.get.mockResolvedValue(JSON.stringify(validSessionData))

      const result = await sessionStore.getSession(sessionId)

      expect(result).toEqual(validSessionData)
      expect(mockRedisClient.get).toHaveBeenCalledWith(`session:${sessionId}`)
    })

    test('should return null for non-existent session', async () => {
      const sessionId = generateTestSessionId()
      mockRedisClient.get.mockResolvedValue(null)

      const result = await sessionStore.getSession(sessionId)

      expect(result).toBeNull()
      expect(mockRedisClient.get).toHaveBeenCalledWith(`session:${sessionId}`)
    })

    test('should handle Redis errors during session retrieval', async () => {
      const sessionId = generateTestSessionId()
      setupRedisError(mockRedisClient, 'Redis error')

      await expect(sessionStore.getSession(sessionId)).rejects.toThrow(
        'Redis error'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error retrieving session ${sessionId}: Redis error`
      )
    })

    test('should handle corrupted session data', async () => {
      const sessionId = generateTestSessionId()
      mockRedisClient.get.mockResolvedValue('invalid-json')

      await expect(sessionStore.getSession(sessionId)).rejects.toThrow(
        'Invalid session data format'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Corrupted session data for ${sessionId}`
      )
    })
  })

  describe('Session Updates', () => {
    beforeEach(async () => {
      await sessionStore.connect()
    })

    test('should update existing session data', async () => {
      const sessionId = generateTestSessionId()
      const updatedData = createValidSessionData({ access_token: 'new-token' })

      mockRedisClient.exists.mockResolvedValue(1)
      mockRedisClient.setex.mockResolvedValue('OK')

      const result = await sessionStore.updateSession(sessionId, updatedData)

      expect(result).toBe(true)
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `session:${sessionId}`,
        14400,
        JSON.stringify(updatedData)
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Session updated: ${sessionId}`
      )
    })

    test('should throw error when updating non-existent session', async () => {
      const sessionId = generateTestSessionId()
      mockRedisClient.exists.mockResolvedValue(0)

      await expect(
        sessionStore.updateSession(sessionId, validSessionData)
      ).rejects.toThrow(`Session not found: ${sessionId}`)
    })

    test('should handle Redis errors during session update', async () => {
      const sessionId = generateTestSessionId()
      mockRedisClient.exists.mockResolvedValue(1)
      setupRedisError(mockRedisClient, 'Redis error')

      await expect(
        sessionStore.updateSession(sessionId, validSessionData)
      ).rejects.toThrow('Redis error')
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error updating session ${sessionId}: Redis error`
      )
    })

    test('should validate updated session data structure', async () => {
      const sessionId = generateTestSessionId()
      mockRedisClient.exists.mockResolvedValue(1)

      await expect(
        sessionStore.updateSession(
          sessionId,
          createInvalidSessionData.missingAccessToken
        )
      ).rejects.toThrow('Invalid session data: missing required fields')
    })
  })

  describe('Session Deletion', () => {
    beforeEach(async () => {
      await sessionStore.connect()
    })

    test('should delete existing session', async () => {
      const sessionId = generateTestSessionId()
      mockRedisClient.del.mockResolvedValue(1)

      const result = await sessionStore.deleteSession(sessionId)

      expect(result).toBe(true)
      expect(mockRedisClient.del).toHaveBeenCalledWith(`session:${sessionId}`)
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Session deleted: ${sessionId}`
      )
    })

    test('should handle deletion of non-existent session', async () => {
      const sessionId = generateTestSessionId()
      mockRedisClient.del.mockResolvedValue(0)

      const result = await sessionStore.deleteSession(sessionId)

      expect(result).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Session not found for deletion: ${sessionId}`
      )
    })

    test('should handle Redis errors during session deletion', async () => {
      const sessionId = generateTestSessionId()
      setupRedisError(mockRedisClient, 'Redis error')

      await expect(sessionStore.deleteSession(sessionId)).rejects.toThrow(
        'Redis error'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error deleting session ${sessionId}: Redis error`
      )
    })
  })

  describe('Session Existence Check', () => {
    beforeEach(async () => {
      await sessionStore.connect()
    })

    test('should return true for existing session', async () => {
      const sessionId = generateTestSessionId()
      mockRedisClient.exists.mockResolvedValue(1)

      const result = await sessionStore.sessionExists(sessionId)

      expect(result).toBe(true)
      expect(mockRedisClient.exists).toHaveBeenCalledWith(
        `session:${sessionId}`
      )
    })

    test('should return false for non-existent session', async () => {
      const sessionId = generateTestSessionId()
      mockRedisClient.exists.mockResolvedValue(0)

      const result = await sessionStore.sessionExists(sessionId)

      expect(result).toBe(false)
    })
  })

  describe('Session TTL Management', () => {
    beforeEach(async () => {
      await sessionStore.connect()
    })

    test('should get session TTL', async () => {
      const sessionId = generateTestSessionId()
      mockRedisClient.ttl.mockResolvedValue(3600)

      const result = await sessionStore.getSessionTtl(sessionId)

      expect(result).toBe(3600)
      expect(mockRedisClient.ttl).toHaveBeenCalledWith(`session:${sessionId}`)
    })

    test('should refresh session TTL for existing session', async () => {
      const sessionId = generateTestSessionId()
      mockRedisClient.expire.mockResolvedValue(1)

      const result = await sessionStore.refreshSessionTtl(sessionId)

      expect(result).toBe(true)
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        `session:${sessionId}`,
        14400
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Session TTL refreshed: ${sessionId}`
      )
    })

    test('should handle refresh TTL for non-existent session', async () => {
      const sessionId = generateTestSessionId()
      mockRedisClient.expire.mockResolvedValue(0)

      const result = await sessionStore.refreshSessionTtl(sessionId)

      expect(result).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Cannot refresh TTL for non-existent session: ${sessionId}`
      )
    })
  })
})
