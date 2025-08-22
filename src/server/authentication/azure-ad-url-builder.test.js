import { vi } from 'vitest'
import { OAUTH_CONSTANTS } from '../common/constants/authentication-constants.js'
import { buildAuthorizationUrl } from './azure-ad-url-builder.js'
import {
  validateAndGetAzureAdConfig,
  buildAzureAdEndpointUrl
} from './azure-ad-config.js'

// Mock the azure-ad-config module
vi.mock('./azure-ad-config.js', () => ({
  validateAndGetAzureAdConfig: vi.fn(),
  buildAzureAdEndpointUrl: vi.fn()
}))

describe('#azure-ad-url-builder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('buildAuthorizationUrl', () => {
    test('Should build correct authorization URL with all parameters', () => {
      const state = 'test-state-123'
      const codeChallenge = 'test-code-challenge-abc'

      // Mock the config validation and URL building
      vi.mocked(validateAndGetAzureAdConfig).mockReturnValue({
        baseUrl: 'https://login.microsoftonline.com',
        clientId: 'test-client-id-456',
        redirectUri: 'https://example.com/auth/callback',
        tenantId: 'test-tenant-789',
        authorizeEndpoint: 'oauth2/v2.0/authorize'
      })

      vi.mocked(buildAzureAdEndpointUrl).mockReturnValue(
        'https://login.microsoftonline.com/test-tenant-789/oauth2/v2.0/authorize'
      )

      const url = buildAuthorizationUrl(state, codeChallenge)

      expect(url).toBe(
        'https://login.microsoftonline.com/test-tenant-789/oauth2/v2.0/authorize?' +
          'client_id=test-client-id-456&' +
          'response_type=code&' +
          'redirect_uri=https%3A%2F%2Fexample.com%2Fauth%2Fcallback&' +
          'response_mode=query&' +
          'scope=openid+profile+email&' +
          'state=test-state-123&' +
          'code_challenge=test-code-challenge-abc&' +
          'code_challenge_method=S256'
      )

      expect(validateAndGetAzureAdConfig).toHaveBeenCalledWith([
        'baseUrl',
        'clientId',
        'redirectUri',
        'tenantId',
        'authorizeEndpoint'
      ])
      expect(buildAzureAdEndpointUrl).toHaveBeenCalledWith(
        'https://login.microsoftonline.com',
        'test-tenant-789',
        'oauth2/v2.0/authorize'
      )
    })

    test('Should handle special characters in parameters', () => {
      const state = 'state+with/special=chars'
      const codeChallenge = 'challenge&with#special'

      vi.mocked(validateAndGetAzureAdConfig).mockReturnValue({
        baseUrl: 'https://auth.example.com',
        clientId: 'client&id',
        redirectUri: 'https://example.com/auth?callback=true',
        tenantId: 'tenant/id',
        authorizeEndpoint: 'auth'
      })

      vi.mocked(buildAzureAdEndpointUrl).mockReturnValue(
        'https://auth.example.com/tenant/id/auth'
      )

      const url = buildAuthorizationUrl(state, codeChallenge)

      // Verify URL encoding is applied correctly
      expect(url).toContain('state=state%2Bwith%2Fspecial%3Dchars')
      expect(url).toContain('code_challenge=challenge%26with%23special')
      expect(url).toContain('client_id=client%26id')
      expect(url).toContain(
        'redirect_uri=https%3A%2F%2Fexample.com%2Fauth%3Fcallback%3Dtrue'
      )
    })

    test('Should throw error when configuration validation fails', () => {
      vi.mocked(validateAndGetAzureAdConfig).mockImplementation(() => {
        throw new Error(
          'Azure AD configuration is incomplete. Missing: clientId'
        )
      })

      expect(() => buildAuthorizationUrl('state', 'challenge')).toThrow(
        'Azure AD configuration is incomplete. Missing: clientId'
      )
    })

    test('Should use correct OAuth constants', () => {
      vi.mocked(validateAndGetAzureAdConfig).mockReturnValue({
        baseUrl: 'https://auth.com',
        clientId: 'client',
        redirectUri: 'https://example.com/callback',
        tenantId: 'tenant',
        authorizeEndpoint: 'auth'
      })

      vi.mocked(buildAzureAdEndpointUrl).mockReturnValue(
        'https://auth.com/tenant/auth'
      )

      const url = buildAuthorizationUrl('state', 'challenge')

      expect(url).toContain(`response_type=${OAUTH_CONSTANTS.RESPONSE_TYPE}`)
      expect(url).toContain(`response_mode=${OAUTH_CONSTANTS.RESPONSE_MODE}`)
      expect(url).toContain('scope=openid+profile+email')
      expect(url).toContain(
        `code_challenge_method=${OAUTH_CONSTANTS.CODE_CHALLENGE_METHOD}`
      )
    })
  })
})
