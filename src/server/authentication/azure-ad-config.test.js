import { vi } from 'vitest'
import { config } from '../../config/config.js'
import {
  validateAndGetAzureAdConfig,
  buildAzureAdEndpointUrl
} from './azure-ad-config.js'

describe('#azure-ad-config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateAndGetAzureAdConfig', () => {
    const mockConfigGet = (values) => {
      vi.spyOn(config, 'get').mockImplementation((key) => values[key])
    }

    test('returns configuration when all required fields are present', () => {
      mockConfigGet({
        'azureAd.baseUrl': 'https://login.microsoftonline.com',
        'azureAd.clientId': 'test-client-id',
        'azureAd.tenantId': 'test-tenant'
      })

      const result = validateAndGetAzureAdConfig([
        'baseUrl',
        'clientId',
        'tenantId'
      ])

      expect(result).toEqual({
        baseUrl: 'https://login.microsoftonline.com',
        clientId: 'test-client-id',
        tenantId: 'test-tenant'
      })
    })

    test.each([
      {
        name: 'null value',
        values: {
          'azureAd.baseUrl': 'https://login.microsoftonline.com',
          'azureAd.clientId': null
        },
        fields: ['baseUrl', 'clientId'],
        expectedMissing: 'clientId'
      },
      {
        name: 'empty string',
        values: { 'azureAd.baseUrl': '', 'azureAd.clientId': 'test-client-id' },
        fields: ['baseUrl', 'clientId'],
        expectedMissing: 'baseUrl'
      },
      {
        name: 'undefined value',
        values: {
          'azureAd.baseUrl': 'https://login.microsoftonline.com',
          'azureAd.clientId': undefined
        },
        fields: ['baseUrl', 'clientId'],
        expectedMissing: 'clientId'
      },
      {
        name: 'multiple missing fields',
        values: {
          'azureAd.baseUrl': null,
          'azureAd.clientId': 'test-client-id',
          'azureAd.tenantId': null
        },
        fields: ['baseUrl', 'clientId', 'tenantId'],
        expectedMissing: 'baseUrl, tenantId'
      }
    ])(
      'throws error when configuration has $name',
      ({ values, fields, expectedMissing }) => {
        mockConfigGet(values)

        expect(() => validateAndGetAzureAdConfig(fields)).toThrow(
          `Azure AD configuration is incomplete. Missing: ${expectedMissing}`
        )
      }
    )

    test('returns configuration for single field', () => {
      mockConfigGet({ 'azureAd.baseUrl': 'https://login.microsoftonline.com' })

      const result = validateAndGetAzureAdConfig(['baseUrl'])

      expect(result).toEqual({ baseUrl: 'https://login.microsoftonline.com' })
    })

    test('returns empty object when no fields required', () => {
      const result = validateAndGetAzureAdConfig([])
      expect(result).toEqual({})
    })
  })

  describe('buildAzureAdEndpointUrl', () => {
    test('builds URL for standard OAuth endpoint', () => {
      const baseUrl = 'https://login.microsoftonline.com'
      const tenantId = 'test-tenant-id'
      const endpoint = 'oauth2/v2.0/authorize'

      const result = buildAzureAdEndpointUrl(baseUrl, tenantId, endpoint)

      expect(result).toBe(
        'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/authorize'
      )
    })
  })
})
