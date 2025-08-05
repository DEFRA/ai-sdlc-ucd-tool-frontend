import { vi } from 'vitest'
import { OAUTH_CONSTANTS } from '../common/constants/authentication-constants.js'
import {
  storeStateParameter,
  storePkceVerifier,
  validateStateParameter,
  retrievePkceVerifier
} from './oauth-state-storage.js'

// Mock Redis client
vi.mock('../common/helpers/redis-client.js', () => {
  const mockRedisClient = {
    set: vi.fn(),
    exists: vi.fn(),
    del: vi.fn(),
    get: vi.fn(),
    on: vi.fn()
  }

  return {
    buildRedisClient: vi.fn(() => mockRedisClient),
    __mockRedisClient: mockRedisClient
  }
})

describe('#oauth-state-storage', () => {
  let mockRedisClient

  beforeEach(async () => {
    vi.clearAllMocks()
    // Get the mock Redis client from the module
    const { __mockRedisClient } = await import(
      '../common/helpers/redis-client.js'
    )
    mockRedisClient = __mockRedisClient
  })

  describe('storeStateParameter', () => {
    test('Should store state parameter in Redis with correct TTL', async () => {
      const state = 'test-state-123'
      mockRedisClient.set.mockResolvedValue('OK')

      await storeStateParameter(state)

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.STATE_KEY_PREFIX}test-state-123`,
        '1',
        'EX',
        OAUTH_CONSTANTS.STATE_TTL_SECONDS
      )
    })

    test('Should handle Redis errors', async () => {
      const state = 'test-state'
      const error = new Error('Redis connection failed')
      mockRedisClient.set.mockRejectedValue(error)

      await expect(storeStateParameter(state)).rejects.toThrow(
        'Redis connection failed'
      )
    })
  })

  describe('storePkceVerifier', () => {
    test('Should store PKCE verifier in Redis with correct TTL', async () => {
      const state = 'test-state-456'
      const codeVerifier = 'test-verifier-xyz'
      mockRedisClient.set.mockResolvedValue('OK')

      await storePkceVerifier(state, codeVerifier)

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.PKCE_KEY_PREFIX}test-state-456`,
        'test-verifier-xyz',
        'EX',
        OAUTH_CONSTANTS.STATE_TTL_SECONDS
      )
    })

    test('Should handle empty code verifier', async () => {
      const state = 'test-state'
      const codeVerifier = ''
      mockRedisClient.set.mockResolvedValue('OK')

      await storePkceVerifier(state, codeVerifier)

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.PKCE_KEY_PREFIX}test-state`,
        '',
        'EX',
        OAUTH_CONSTANTS.STATE_TTL_SECONDS
      )
    })
  })

  describe('validateStateParameter', () => {
    test('Should return true for valid state and delete it', async () => {
      const state = 'valid-state-789'
      mockRedisClient.exists.mockResolvedValue(1)
      mockRedisClient.del.mockResolvedValue(1)

      const isValid = await validateStateParameter(state)

      expect(isValid).toBe(true)
      expect(mockRedisClient.exists).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.STATE_KEY_PREFIX}valid-state-789`
      )
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.STATE_KEY_PREFIX}valid-state-789`
      )
    })

    test('Should return false for invalid state and not delete', async () => {
      const state = 'invalid-state'
      mockRedisClient.exists.mockResolvedValue(0)

      const isValid = await validateStateParameter(state)

      expect(isValid).toBe(false)
      expect(mockRedisClient.exists).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.STATE_KEY_PREFIX}invalid-state`
      )
      expect(mockRedisClient.del).not.toHaveBeenCalled()
    })

    test('Should handle multiple exists return values correctly', async () => {
      const state = 'test-state'
      mockRedisClient.exists.mockResolvedValue(2) // Multiple keys exist

      const isValid = await validateStateParameter(state)

      expect(isValid).toBe(false) // Only exactly 1 should return true
      expect(mockRedisClient.del).toHaveBeenCalled()
    })
  })

  describe('retrievePkceVerifier', () => {
    test('Should retrieve and delete PKCE verifier', async () => {
      const state = 'test-state-abc'
      const expectedVerifier = 'secure-verifier-123'
      mockRedisClient.get.mockResolvedValue(expectedVerifier)
      mockRedisClient.del.mockResolvedValue(1)

      const verifier = await retrievePkceVerifier(state)

      expect(verifier).toBe(expectedVerifier)
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.PKCE_KEY_PREFIX}test-state-abc`
      )
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.PKCE_KEY_PREFIX}test-state-abc`
      )
    })

    test('Should return null when verifier not found', async () => {
      const state = 'missing-state'
      mockRedisClient.get.mockResolvedValue(null)

      const verifier = await retrievePkceVerifier(state)

      expect(verifier).toBeNull()
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.PKCE_KEY_PREFIX}missing-state`
      )
      expect(mockRedisClient.del).not.toHaveBeenCalled()
    })

    test('Should handle Redis errors during retrieval', async () => {
      const state = 'test-state'
      const error = new Error('Redis read failed')
      mockRedisClient.get.mockRejectedValue(error)

      await expect(retrievePkceVerifier(state)).rejects.toThrow(
        'Redis read failed'
      )
    })
  })
})
