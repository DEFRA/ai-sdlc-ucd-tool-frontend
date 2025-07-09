import { vi } from 'vitest'

/**
 * Session Store Test Helpers
 * Provides common mocks, fixtures, and utilities for session store testing
 */

/**
 * Mock Redis client with common methods
 */
export const createMockRedisClient = () => ({
  setex: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  ttl: vi.fn(),
  expire: vi.fn(),
  quit: vi.fn(),
  on: vi.fn(),
  status: 'ready'
})

/**
 * Mock logger with common methods
 */
export const createMockLogger = () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
})

/**
 * Mock Hapi response toolkit
 */
export const createMockHapiResponse = () => ({
  response: vi.fn().mockReturnThis(),
  code: vi.fn().mockReturnThis(),
  view: vi.fn().mockReturnThis()
})

/**
 * Valid session data fixture
 */
export const createValidSessionData = (overrides = {}) => ({
  user_id: 'test-user-123',
  access_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...',
  refresh_token: 'refresh-token-123',
  token_expiry: Date.now() + 3600000,
  ...overrides
})

/**
 * Invalid session data fixtures
 */
export const createInvalidSessionData = {
  missingUserId: {
    access_token: 'token',
    refresh_token: 'refresh',
    token_expiry: Date.now() + 3600000
  },
  missingAccessToken: {
    user_id: 'user-123',
    refresh_token: 'refresh',
    token_expiry: Date.now() + 3600000
  },
  missingRefreshToken: {
    user_id: 'user-123',
    access_token: 'token',
    token_expiry: Date.now() + 3600000
  },
  missingTokenExpiry: {
    user_id: 'user-123',
    access_token: 'token',
    refresh_token: 'refresh'
  }
}

/**
 * Session store configuration defaults
 */
export const sessionStoreConfig = {
  sessionTtl: 14400000, // 4 hours in milliseconds
  maxSessionSize: 50000,
  defaultRedisConfig: {
    host: 'localhost',
    port: 6379
  }
}

/**
 * Common test scenarios
 */
export const testScenarios = {
  validSession: {
    sessionId: 'valid-session-123',
    data: createValidSessionData()
  },
  expiredSession: {
    sessionId: 'expired-session-123',
    data: createValidSessionData({
      token_expiry: Date.now() - 3600000 // 1 hour ago
    })
  },
  malformedSession: {
    sessionId: 'malformed-session-123',
    data: 'invalid-json-data'
  }
}

/**
 * Setup function for session store tests
 */
export const setupSessionStoreTest = () => {
  const mockRedisClient = createMockRedisClient()
  const mockLogger = createMockLogger()
  const mockH = createMockHapiResponse()

  // Mock dependencies
  vi.mock('../helpers/redis-client.js', () => ({
    buildRedisClient: vi.fn(() => mockRedisClient)
  }))

  vi.mock('../helpers/logging/logger.js', () => ({
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

  return {
    mockRedisClient,
    mockLogger,
    mockH,
    validSessionData: createValidSessionData(),
    invalidSessionData: createInvalidSessionData,
    testScenarios
  }
}

/**
 * Setup Redis client success responses
 */
export const setupRedisSuccess = (mockRedisClient) => {
  mockRedisClient.setex.mockResolvedValue('OK')
  mockRedisClient.get.mockResolvedValue(
    JSON.stringify(createValidSessionData())
  )
  mockRedisClient.exists.mockResolvedValue(1)
  mockRedisClient.del.mockResolvedValue(1)
  mockRedisClient.ttl.mockResolvedValue(3600)
  mockRedisClient.expire.mockResolvedValue(1)
  mockRedisClient.quit.mockResolvedValue('OK')
}

/**
 * Setup Redis client error responses
 */
export const setupRedisError = (
  mockRedisClient,
  errorMessage = 'Redis error'
) => {
  const error = new Error(errorMessage)
  mockRedisClient.setex.mockRejectedValue(error)
  mockRedisClient.get.mockRejectedValue(error)
  mockRedisClient.exists.mockRejectedValue(error)
  mockRedisClient.del.mockRejectedValue(error)
  mockRedisClient.ttl.mockRejectedValue(error)
  mockRedisClient.expire.mockRejectedValue(error)
  mockRedisClient.quit.mockRejectedValue(error)
}

/**
 * Setup Redis client connection errors
 */
export const setupRedisConnectionError = (mockRedisClient) => {
  mockRedisClient.status = 'error'
  mockRedisClient.on.mockImplementation((event, callback) => {
    if (event === 'error') {
      callback(new Error('Connection failed'))
    }
  })
}

/**
 * Assert common success response structure
 */
export const assertSuccessResponse = (
  mockH,
  expectedMessage,
  expectedData = {}
) => {
  expect(mockH.response).toHaveBeenCalledWith({
    success: true,
    message: expectedMessage,
    ...expectedData
  })
}

/**
 * Assert common error response structure
 */
export const assertErrorResponse = (
  mockH,
  expectedMessage,
  statusCode = 500
) => {
  expect(mockH.response).toHaveBeenCalledWith({
    success: false,
    message: expect.stringContaining(expectedMessage),
    error: expect.any(String)
  })
  expect(mockH.code).toHaveBeenCalledWith(statusCode)
}

/**
 * Assert session data structure
 */
export const assertSessionDataStructure = (sessionData) => {
  expect(sessionData).toHaveProperty('user_id')
  expect(sessionData).toHaveProperty('access_token')
  expect(sessionData).toHaveProperty('refresh_token')
  expect(sessionData).toHaveProperty('token_expiry')
  expect(typeof sessionData.user_id).toBe('string')
  expect(typeof sessionData.access_token).toBe('string')
  expect(typeof sessionData.refresh_token).toBe('string')
  expect(typeof sessionData.token_expiry).toBe('number')
}

/**
 * Generate random session ID for testing
 */
export const generateTestSessionId = (prefix = 'test-session') => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create oversized session data for testing size limits
 */
export const createOversizedSessionData = () => ({
  user_id: 'test-user',
  access_token: 'x'.repeat(100000), // 100KB token
  refresh_token: 'refresh-token',
  token_expiry: Date.now() + 3600000
})

/**
 * Clean up test mocks
 */
export const cleanupMocks = () => {
  vi.clearAllMocks()
  vi.resetAllMocks()
}
