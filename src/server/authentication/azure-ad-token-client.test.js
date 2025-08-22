import { vi } from 'vitest'
import { exchangeCodeForTokens } from './azure-ad-token-client.js'
import {
  validateAndGetAzureAdConfig,
  buildAzureAdEndpointUrl
} from './azure-ad-config.js'

// Mock fetch at module level
vi.stubGlobal('fetch', vi.fn())

// Mock the azure-ad-config module
vi.mock('./azure-ad-config.js', () => ({
  validateAndGetAzureAdConfig: vi.fn(),
  buildAzureAdEndpointUrl: vi.fn()
}))

describe('#azure-ad-token-client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('exchangeCodeForTokens', () => {
    test('Should successfully exchange authorization code for tokens', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token-123',
        refresh_token: 'mock-refresh-token-456',
        id_token: 'mock-id-token-789',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'openid profile email'
      }

      // Mock config validation and URL building
      vi.mocked(validateAndGetAzureAdConfig).mockReturnValue({
        baseUrl: 'https://login.microsoftonline.com',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret-xyz',
        redirectUri: 'https://example.com/auth/callback',
        tenantId: 'test-tenant-id',
        tokenEndpoint: 'oauth2/v2.0/token'
      })

      vi.mocked(buildAzureAdEndpointUrl).mockReturnValue(
        'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/token'
      )

      // Mock successful fetch response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTokenResponse)
      })

      const tokens = await exchangeCodeForTokens(
        'test-auth-code-abc',
        'test-code-verifier-def'
      )

      expect(tokens).toEqual(mockTokenResponse)
      expect(validateAndGetAzureAdConfig).toHaveBeenCalledWith([
        'baseUrl',
        'clientId',
        'clientSecret',
        'redirectUri',
        'tenantId',
        'tokenEndpoint'
      ])
      expect(buildAzureAdEndpointUrl).toHaveBeenCalledWith(
        'https://login.microsoftonline.com',
        'test-tenant-id',
        'oauth2/v2.0/token'
      )
      expect(fetch).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'client_id=test-client-id&client_secret=test-client-secret-xyz&code=test-auth-code-abc&grant_type=authorization_code&redirect_uri=https%3A%2F%2Fexample.com%2Fauth%2Fcallback&code_verifier=test-code-verifier-def'
        }
      )
    })

    test('Should handle special characters in parameters', async () => {
      vi.mocked(validateAndGetAzureAdConfig).mockReturnValue({
        baseUrl: 'https://auth.example.com',
        clientId: 'client&id=special',
        clientSecret: 'secret+with/chars',
        redirectUri: 'https://example.com/auth?param=value',
        tenantId: 'tenant-id',
        tokenEndpoint: 'token'
      })

      vi.mocked(buildAzureAdEndpointUrl).mockReturnValue(
        'https://auth.example.com/tenant-id/token'
      )

      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ access_token: 'token' })
      })

      await exchangeCodeForTokens('code+special', 'verifier&special')

      const fetchCall = fetch.mock.calls[0]
      const body = fetchCall[1].body

      // Verify special characters are properly encoded
      expect(body).toContain('client_id=client%26id%3Dspecial')
      expect(body).toContain('client_secret=secret%2Bwith%2Fchars')
      expect(body).toContain('code=code%2Bspecial')
      expect(body).toContain('code_verifier=verifier%26special')
      expect(body).toContain(
        'redirect_uri=https%3A%2F%2Fexample.com%2Fauth%3Fparam%3Dvalue'
      )
    })

    test('Should throw error when configuration validation fails', async () => {
      vi.mocked(validateAndGetAzureAdConfig).mockImplementation(() => {
        throw new Error(
          'Azure AD configuration is incomplete. Missing: clientSecret'
        )
      })

      await expect(exchangeCodeForTokens('code', 'verifier')).rejects.toThrow(
        'Azure AD configuration is incomplete. Missing: clientSecret'
      )
    })

    test('Should throw error when token exchange fails with 400 status', async () => {
      vi.mocked(validateAndGetAzureAdConfig).mockReturnValue({
        baseUrl: 'https://auth.com',
        clientId: 'client',
        clientSecret: 'secret',
        redirectUri: 'https://example.com',
        tenantId: 'tenant',
        tokenEndpoint: 'token'
      })

      vi.mocked(buildAzureAdEndpointUrl).mockReturnValue(
        'https://auth.com/tenant/token'
      )

      const errorResponse = {
        error: 'invalid_grant',
        error_description: 'The authorization code is invalid or expired'
      }

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue(JSON.stringify(errorResponse))
      })

      await expect(
        exchangeCodeForTokens('bad-code', 'verifier')
      ).rejects.toThrow('Token exchange failed with status: 400')
    })

    test('Should throw error when token exchange fails with 401 status', async () => {
      vi.mocked(validateAndGetAzureAdConfig).mockReturnValue({
        baseUrl: 'https://auth.com',
        clientId: 'client',
        clientSecret: 'wrong-secret',
        redirectUri: 'https://example.com',
        tenantId: 'tenant',
        tokenEndpoint: 'token'
      })

      vi.mocked(buildAzureAdEndpointUrl).mockReturnValue(
        'https://auth.com/tenant/token'
      )

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: vi
          .fn()
          .mockResolvedValue('Unauthorized: Invalid client credentials')
      })

      await expect(exchangeCodeForTokens('code', 'verifier')).rejects.toThrow(
        'Token exchange failed with status: 401'
      )
    })

    test('Should throw error when fetch fails with network error', async () => {
      vi.mocked(validateAndGetAzureAdConfig).mockReturnValue({
        baseUrl: 'https://auth.com',
        clientId: 'client',
        clientSecret: 'secret',
        redirectUri: 'https://example.com',
        tenantId: 'tenant',
        tokenEndpoint: 'token'
      })

      vi.mocked(buildAzureAdEndpointUrl).mockReturnValue(
        'https://auth.com/tenant/token'
      )

      const networkError = new Error('Network connection failed')
      fetch.mockRejectedValueOnce(networkError)

      await expect(exchangeCodeForTokens('code', 'verifier')).rejects.toThrow(
        'Network connection failed'
      )
    })

    test('Should throw error when response JSON parsing fails', async () => {
      vi.mocked(validateAndGetAzureAdConfig).mockReturnValue({
        baseUrl: 'https://auth.com',
        clientId: 'client',
        clientSecret: 'secret',
        redirectUri: 'https://example.com',
        tenantId: 'tenant',
        tokenEndpoint: 'token'
      })

      vi.mocked(buildAzureAdEndpointUrl).mockReturnValue(
        'https://auth.com/tenant/token'
      )

      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      })

      await expect(exchangeCodeForTokens('code', 'verifier')).rejects.toThrow(
        'Invalid JSON'
      )
    })

    test('Should include all required parameters in request body', async () => {
      vi.mocked(validateAndGetAzureAdConfig).mockReturnValue({
        baseUrl: 'https://auth.com',
        clientId: 'client-123',
        clientSecret: 'secret-456',
        redirectUri: 'https://example.com/callback',
        tenantId: 'tenant-789',
        tokenEndpoint: 'token'
      })

      vi.mocked(buildAzureAdEndpointUrl).mockReturnValue(
        'https://auth.com/tenant-789/token'
      )

      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ access_token: 'token' })
      })

      await exchangeCodeForTokens('auth-code-xyz', 'verifier-abc')

      const fetchCall = fetch.mock.calls[0]
      const body = fetchCall[1].body

      // Verify all required OAuth parameters are included
      expect(body).toContain('client_id=client-123')
      expect(body).toContain('client_secret=secret-456')
      expect(body).toContain('code=auth-code-xyz')
      expect(body).toContain('grant_type=authorization_code')
      expect(body).toContain(
        'redirect_uri=https%3A%2F%2Fexample.com%2Fcallback'
      )
      expect(body).toContain('code_verifier=verifier-abc')
    })
  })
})
