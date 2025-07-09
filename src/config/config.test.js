import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import {
  getAzureAdConfig,
  validateAzureAdConfig,
  getRedisConfig,
  validateRedisConfig,
  getRedisProductionDefaults,
  getSessionConfig,
  validateSessionConfig,
  loadEnvironmentConfig,
  validateStartupConfiguration
} from './config.js'

describe('Core Configuration Module (Story 1.1)', () => {
  let originalEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Azure AD OAuth Configuration', () => {
    test('should extract Azure AD OAuth settings from environment variables', () => {
      // GIVEN Azure AD environment variables are set
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id'
      process.env.AZURE_AD_CLIENT_SECRET = 'test-client-secret'
      process.env.AZURE_AD_TENANT_ID = 'test-tenant-id'
      process.env.AZURE_AD_REDIRECT_URI = 'http://localhost:3000/auth/callback'

      // WHEN configuration is loaded
      const azureConfig = getAzureAdConfig()

      // THEN it should contain all OAuth settings
      expect(azureConfig.clientId).toBe('test-client-id')
      expect(azureConfig.clientSecret).toBe('test-client-secret')
      expect(azureConfig.tenantId).toBe('test-tenant-id')
      expect(azureConfig.redirectUri).toBe(
        'http://localhost:3000/auth/callback'
      )
    })

    test('should require all OAuth settings in production environment', () => {
      // GIVEN the application is in production
      process.env.NODE_ENV = 'production'
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id'
      // Missing other required settings

      // WHEN validation occurs
      // THEN it should throw an error for missing settings
      expect(() => validateAzureAdConfig()).toThrow(
        'Missing required Azure AD configuration'
      )
    })

    test('should provide development defaults when Azure AD config is missing', () => {
      // GIVEN the application is in development
      process.env.NODE_ENV = 'development'
      // No Azure AD environment variables set

      // WHEN configuration is loaded
      const azureConfig = getAzureAdConfig()

      // THEN it should provide sensible defaults
      expect(azureConfig.clientId).toBe('dev-client-id')
      expect(azureConfig.tenantId).toBe('common')
      expect(azureConfig.redirectUri).toContain('localhost')
    })

    test('should throw descriptive errors for invalid Azure AD configuration', () => {
      // GIVEN invalid Azure AD configuration
      process.env.AZURE_AD_CLIENT_ID = ''
      process.env.AZURE_AD_TENANT_ID = 'invalid-tenant'

      // WHEN validation occurs
      // THEN it should provide clear error messages
      expect(() => validateAzureAdConfig()).toThrow(
        'Azure AD Client ID cannot be empty'
      )
    })
  })

  describe('Redis Connection Configuration', () => {
    test('should extract Redis connection details from environment variables', () => {
      // GIVEN Redis environment variables are set
      process.env.REDIS_HOST = 'redis.example.com'
      process.env.REDIS_PORT = '6380'
      process.env.REDIS_USERNAME = 'redis-user'
      process.env.REDIS_PASSWORD = 'redis-password'
      process.env.REDIS_TLS = 'true'

      // WHEN configuration is loaded
      const redisConfig = getRedisConfig()

      // THEN it should contain all connection settings
      expect(redisConfig.host).toBe('redis.example.com')
      expect(redisConfig.port).toBe(6380)
      expect(redisConfig.username).toBe('redis-user')
      expect(redisConfig.password).toBe('redis-password')
      expect(redisConfig.useTLS).toBe(true)
    })

    test('should require password and enable TLS in production', () => {
      // GIVEN the application is in production
      process.env.NODE_ENV = 'production'
      // No Redis password set

      // WHEN Redis configuration is validated
      // THEN it should require password and TLS
      expect(() => validateRedisConfig()).toThrow(
        'Redis password is required in production'
      )

      const prodDefaults = getRedisProductionDefaults()
      expect(prodDefaults.useTLS).toBe(true)
    })

    test('should default to localhost with no auth in development', () => {
      // GIVEN the application is in development
      process.env.NODE_ENV = 'development'

      // WHEN Redis configuration is loaded
      const redisConfig = getRedisConfig()

      // THEN it should use localhost defaults
      expect(redisConfig.host).toBe('127.0.0.1')
      expect(redisConfig.password).toBe('')
      expect(redisConfig.useTLS).toBe(false)
    })

    test('should provide clear error messages for invalid Redis parameters', () => {
      // GIVEN invalid Redis configuration
      process.env.REDIS_PORT = 'invalid-port'
      process.env.REDIS_HOST = ''

      // WHEN validation occurs
      // THEN it should provide clear error messages
      expect(() => validateRedisConfig()).toThrow(
        'Redis port must be a valid number'
      )
    })
  })

  describe('Session Management Configuration', () => {
    test('should extract session TTL, cookie settings, and cache engine preferences', () => {
      // GIVEN session environment variables are set
      process.env.SESSION_TTL = '7200000'
      process.env.SESSION_COOKIE_SECURE = 'true'
      process.env.SESSION_COOKIE_HTTP_ONLY = 'true'
      process.env.SESSION_CACHE_ENGINE = 'redis'

      // WHEN session configuration is loaded
      const sessionConfig = getSessionConfig()

      // THEN it should contain all session settings
      expect(sessionConfig.ttl).toBe(7200000)
      expect(sessionConfig.cookie.secure).toBe(true)
      expect(sessionConfig.cookie.httpOnly).toBe(true)
      expect(sessionConfig.cache.engine).toBe('redis')
    })

    test('should default session TTL to 4 hours when not specified', () => {
      // GIVEN session TTL is not specified
      delete process.env.SESSION_TTL

      // WHEN configuration is validated
      const sessionConfig = getSessionConfig()

      // THEN it should default to 4 hours (14400000ms)
      expect(sessionConfig.ttl).toBe(14400000)
    })

    test('should enforce secure cookie flags in production', () => {
      // GIVEN the application is in production mode
      process.env.NODE_ENV = 'production'

      // WHEN configuration is loaded
      const sessionConfig = getSessionConfig()

      // THEN it should enforce security flags
      expect(sessionConfig.cookie.secure).toBe(true)
      expect(sessionConfig.cookie.httpOnly).toBe(true)
      expect(sessionConfig.cookie.sameSite).toBe('strict')
    })

    test('should reject negative or zero session timeout values', () => {
      // GIVEN invalid session timeout values
      process.env.SESSION_TTL = '-1000'

      // WHEN configuration is validated
      // THEN it should reject negative values
      expect(() => validateSessionConfig()).toThrow(
        'Session TTL must be positive'
      )

      process.env.SESSION_TTL = '0'
      expect(() => validateSessionConfig()).toThrow(
        'Session TTL must be positive'
      )
    })
  })

  describe('Environment-Specific Configuration', () => {
    test('should enforce strict validation and secure defaults in production', () => {
      // GIVEN NODE_ENV is set to production
      process.env.NODE_ENV = 'production'

      // WHEN configuration is loaded
      const config = loadEnvironmentConfig()

      // THEN it should enforce strict validation
      expect(config.strict).toBe(true)
      expect(config.defaults.secure).toBe(true)
      expect(config.requiresValidation).toBe(true)
    })

    test('should provide permissive defaults for local development', () => {
      // GIVEN NODE_ENV is set to development
      process.env.NODE_ENV = 'development'

      // WHEN configuration is loaded
      const config = loadEnvironmentConfig()

      // THEN it should provide permissive defaults
      expect(config.strict).toBe(false)
      expect(config.allowMissingSecrets).toBe(true)
      expect(config.defaults.secure).toBe(false)
    })

    test('should use in-memory options and disable external dependencies in test', () => {
      // GIVEN NODE_ENV is set to test
      process.env.NODE_ENV = 'test'

      // WHEN configuration is loaded
      const config = loadEnvironmentConfig()

      // THEN it should use test-safe options
      expect(config.cache.engine).toBe('memory')
      expect(config.externalDependencies.enabled).toBe(false)
      expect(config.logging.enabled).toBe(false)
    })
  })

  describe('Startup Validation', () => {
    test('should complete successfully when all required configuration is present', () => {
      // GIVEN all required configuration is present
      setCompleteValidConfiguration()

      // WHEN validation runs
      const result = validateStartupConfiguration()

      // THEN it should complete successfully
      expect(result.valid).toBe(true)
      expect(result.config).toBeDefined()
      expect(result.errors).toHaveLength(0)
    })

    test('should terminate with clear error when required Azure AD settings are missing', () => {
      // GIVEN required Azure AD settings are missing
      process.env.NODE_ENV = 'production'
      delete process.env.AZURE_AD_CLIENT_ID
      delete process.env.AZURE_AD_CLIENT_SECRET

      // WHEN startup validation occurs
      // THEN it should terminate with clear error
      expect(() => validateStartupConfiguration()).toThrow(
        'Missing required Azure AD settings: AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET'
      )
    })

    test('should throw type validation errors for wrong data types', () => {
      // GIVEN configuration values are of wrong type
      process.env.SESSION_TTL = 'not-a-number'
      process.env.REDIS_PORT = 'not-a-port'

      // WHEN validation occurs
      // THEN it should throw type validation errors
      expect(() => validateStartupConfiguration()).toThrow(
        'Type validation failed: SESSION_TTL expected number, got string'
      )
    })
  })
})

// Test helper functions (stubs - will fail until implemented)

function setCompleteValidConfiguration() {
  process.env.NODE_ENV = 'production'
  process.env.AZURE_AD_CLIENT_ID = 'valid-client-id'
  process.env.AZURE_AD_CLIENT_SECRET = 'valid-client-secret'
  process.env.AZURE_AD_TENANT_ID = 'valid-tenant-id'
  process.env.AZURE_AD_REDIRECT_URI = 'https://app.example.com/auth/callback'
  process.env.REDIS_HOST = 'redis.example.com'
  process.env.REDIS_PASSWORD = 'secure-password'
  process.env.SESSION_COOKIE_PASSWORD =
    'a-very-secure-session-cookie-password-that-is-long-enough'
}
