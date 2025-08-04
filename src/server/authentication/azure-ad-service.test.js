import { vi } from 'vitest'
import crypto from 'crypto'
import { OAUTH_CONSTANTS } from '../common/constants/authentication-constants.js'
import { config } from '../../config/config.js'
import {
  generateStateParameter,
  storeStateParameter,
  validateStateParameter,
  generatePkceChallenge,
  storePkceVerifier,
  retrievePkceVerifier,
  buildAuthorizationUrl,
  exchangeCodeForTokens
} from './azure-ad-service.js'

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

// Mock crypto for predictable tests
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(() => ({
      toString: vi.fn(() => 'test-state-parameter')
    })),
    createHash: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => 'test-code-challenge')
      }))
    }))
  }
}))

// Mock fetch at module level for token exchange
vi.stubGlobal('fetch', vi.fn())

describe('#azure-ad-service', () => {
  let mockRedisClient

  beforeEach(async () => {
    vi.clearAllMocks()
    // Get the mock Redis client from the module
    const { __mockRedisClient } = await import(
      '../common/helpers/redis-client.js'
    )
    mockRedisClient = __mockRedisClient
  })

  describe('generateStateParameter', () => {
    test('Should generate a cryptographically secure state parameter', () => {
      const state = generateStateParameter()

      expect(state).toBe('test-state-parameter')
      expect(crypto.randomBytes).toHaveBeenCalledWith(32)
    })
  })

  describe('generatePkceChallenge', () => {
    test('Should generate PKCE code verifier and challenge', () => {
      const { codeVerifier, codeChallenge } = generatePkceChallenge()

      expect(codeVerifier).toBe('test-state-parameter')
      expect(codeChallenge).toBe('test-code-challenge')
      expect(crypto.randomBytes).toHaveBeenCalledWith(32)
      expect(crypto.createHash).toHaveBeenCalledWith('sha256')
    })
  })

  describe('storeStateParameter', () => {
    test('Should store state parameter in Redis with correct TTL', async () => {
      const state = 'test-state'
      mockRedisClient.set.mockResolvedValue('OK')

      await storeStateParameter(state)

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.STATE_KEY_PREFIX}test-state`,
        '1',
        'EX',
        OAUTH_CONSTANTS.STATE_TTL_SECONDS
      )
    })
  })

  describe('storePkceVerifier', () => {
    test('Should store PKCE verifier in Redis with correct TTL', async () => {
      const state = 'test-state'
      const codeVerifier = 'test-verifier'
      mockRedisClient.set.mockResolvedValue('OK')

      await storePkceVerifier(state, codeVerifier)

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.PKCE_KEY_PREFIX}test-state`,
        'test-verifier',
        'EX',
        OAUTH_CONSTANTS.STATE_TTL_SECONDS
      )
    })
  })

  describe('validateStateParameter', () => {
    test('Should return true for valid state parameter and delete it', async () => {
      const state = 'valid-state'
      mockRedisClient.exists.mockResolvedValue(1)
      mockRedisClient.del.mockResolvedValue(1)

      const isValid = await validateStateParameter(state)

      expect(isValid).toBe(true)
      expect(mockRedisClient.exists).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.STATE_KEY_PREFIX}valid-state`
      )
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.STATE_KEY_PREFIX}valid-state`
      )
    })

    test('Should return false for invalid state parameter', async () => {
      const state = 'invalid-state'
      mockRedisClient.exists.mockResolvedValue(0)

      const isValid = await validateStateParameter(state)

      expect(isValid).toBe(false)
      expect(mockRedisClient.exists).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.STATE_KEY_PREFIX}invalid-state`
      )
      expect(mockRedisClient.del).not.toHaveBeenCalled()
    })
  })

  describe('retrievePkceVerifier', () => {
    test('Should retrieve and delete PKCE verifier from Redis', async () => {
      const state = 'test-state'
      const expectedVerifier = 'test-verifier'
      mockRedisClient.get.mockResolvedValue(expectedVerifier)
      mockRedisClient.del.mockResolvedValue(1)

      const verifier = await retrievePkceVerifier(state)

      expect(verifier).toBe(expectedVerifier)
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.PKCE_KEY_PREFIX}test-state`
      )
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.PKCE_KEY_PREFIX}test-state`
      )
    })

    test('Should return null when PKCE verifier not found', async () => {
      const state = 'missing-state'
      mockRedisClient.get.mockResolvedValue(null)

      const verifier = await retrievePkceVerifier(state)

      expect(verifier).toBeNull()
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        `${OAUTH_CONSTANTS.PKCE_KEY_PREFIX}missing-state`
      )
      expect(mockRedisClient.del).not.toHaveBeenCalled()
    })
  })

  describe('buildAuthorizationUrl', () => {
    test('Should build correct authorization URL with all parameters', () => {
      const state = 'test-state'

      // Mock config values
      vi.spyOn(config, 'get').mockImplementation((key) => {
        const values = {
          'azureAd.baseUrl': 'https://test-auth-server.com',
          'azureAd.clientId': 'test-client-id',
          'azureAd.redirectUri': 'http://localhost:3000/auth/callback',
          'azureAd.tenantId': 'test-tenant',
          'azureAd.authorizeEndpoint': 'oauth2/v2.0/authorize'
        }
        return values[key]
      })

      const codeChallenge = 'test-code-challenge'
      const url = buildAuthorizationUrl(state, codeChallenge)

      expect(url).toBe(
        'https://test-auth-server.com/test-tenant/oauth2/v2.0/authorize?' +
          'client_id=test-client-id&' +
          'response_type=code&' +
          'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback&' +
          'response_mode=query&' +
          'scope=openid+profile+email&' +
          'state=test-state&' +
          'code_challenge=test-code-challenge&' +
          'code_challenge_method=S256'
      )
    })

    test('Should throw error when Azure AD configuration is incomplete', () => {
      const state = 'test-state'

      // Mock missing config
      vi.spyOn(config, 'get').mockImplementation((key) => {
        const values = {
          'azureAd.baseUrl': 'https://test-auth-server.com',
          'azureAd.clientId': null,
          'azureAd.redirectUri': 'http://localhost:3000/auth/callback',
          'azureAd.tenantId': 'test-tenant',
          'azureAd.authorizeEndpoint': 'oauth2/v2.0/authorize'
        }
        return values[key]
      })

      expect(() => buildAuthorizationUrl(state, 'test-challenge')).toThrow(
        'Azure AD configuration is incomplete'
      )
    })
  })

  describe('exchangeCodeForTokens', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test('Should successfully exchange authorization code for tokens', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        id_token: 'mock-id-token',
        expires_in: 3600,
        token_type: 'Bearer'
      }

      // Mock config values
      vi.spyOn(config, 'get').mockImplementation((key) => {
        const values = {
          'azureAd.baseUrl': 'https://test-auth-server.com',
          'azureAd.clientId': 'test-client-id',
          'azureAd.clientSecret': 'test-client-secret',
          'azureAd.redirectUri': 'http://localhost:3000/auth/callback',
          'azureAd.tenantId': 'test-tenant',
          'azureAd.tokenEndpoint': 'oauth2/v2.0/token'
        }
        return values[key]
      })

      // Mock successful fetch response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTokenResponse)
      })

      const tokens = await exchangeCodeForTokens(
        'test-auth-code',
        'test-code-verifier'
      )

      expect(tokens).toEqual(mockTokenResponse)
      expect(fetch).toHaveBeenCalledWith(
        'https://test-auth-server.com/test-tenant/oauth2/v2.0/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'client_id=test-client-id&client_secret=test-client-secret&code=test-auth-code&grant_type=authorization_code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback&code_verifier=test-code-verifier'
        }
      )
    })

    test('Should throw error when Azure AD configuration is incomplete', async () => {
      // Mock missing client secret
      vi.spyOn(config, 'get').mockImplementation((key) => {
        const values = {
          'azureAd.clientId': 'test-client-id',
          'azureAd.clientSecret': null,
          'azureAd.redirectUri': 'http://localhost:3000/auth/callback',
          'azureAd.tokenEndpoint':
            'https://login.microsoftonline.com/tenant/oauth2/v2.0/token'
        }
        return values[key]
      })

      await expect(
        exchangeCodeForTokens('test-auth-code', 'test-verifier')
      ).rejects.toThrow('Azure AD configuration is incomplete')
    })

    test('Should throw error when token exchange fails with 400 status', async () => {
      // Mock config values
      vi.spyOn(config, 'get').mockImplementation((key) => {
        const values = {
          'azureAd.baseUrl': 'https://test-auth-server.com',
          'azureAd.clientId': 'test-client-id',
          'azureAd.clientSecret': 'test-client-secret',
          'azureAd.redirectUri': 'http://localhost:3000/auth/callback',
          'azureAd.tenantId': 'test-tenant',
          'azureAd.tokenEndpoint': 'oauth2/v2.0/token'
        }
        return values[key]
      })

      // Mock failed fetch response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi
          .fn()
          .mockResolvedValue(
            '{"error": "invalid_grant", "error_description": "Invalid authorization code"}'
          )
      })

      await expect(
        exchangeCodeForTokens('invalid-auth-code', 'test-verifier')
      ).rejects.toThrow(
        'Token exchange failed: 400 {"error": "invalid_grant", "error_description": "Invalid authorization code"}'
      )
    })

    test('Should throw error when fetch fails with network error', async () => {
      // Mock config values
      vi.spyOn(config, 'get').mockImplementation((key) => {
        const values = {
          'azureAd.baseUrl': 'https://test-auth-server.com',
          'azureAd.clientId': 'test-client-id',
          'azureAd.clientSecret': 'test-client-secret',
          'azureAd.redirectUri': 'http://localhost:3000/auth/callback',
          'azureAd.tenantId': 'test-tenant',
          'azureAd.tokenEndpoint': 'oauth2/v2.0/token'
        }
        return values[key]
      })

      // Mock network error
      fetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(
        exchangeCodeForTokens('test-auth-code', 'test-verifier')
      ).rejects.toThrow('Network error')
    })
  })
})
