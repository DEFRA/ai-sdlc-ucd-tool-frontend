import { vi } from 'vitest'
import crypto from 'crypto'
import {
  generateStateParameter,
  generatePkceChallenge
} from './oauth-crypto-service.js'

// Mock crypto for predictable tests
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(() => ({
      toString: vi.fn((encoding) => {
        if (encoding === 'base64url') {
          return 'test-random-value'
        }
        return 'test-random-value'
      })
    })),
    createHash: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => 'test-hash-value')
      }))
    }))
  }
}))

describe('#oauth-crypto-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateStateParameter', () => {
    test('Should generate a cryptographically secure state parameter', () => {
      const state = generateStateParameter()

      expect(state).toBe('test-random-value')
      expect(crypto.randomBytes).toHaveBeenCalledWith(32)
      expect(crypto.randomBytes).toHaveBeenCalledTimes(1)
    })

    test('Should use base64url encoding', () => {
      generateStateParameter()

      const mockToString = crypto.randomBytes.mock.results[0].value.toString
      expect(mockToString).toHaveBeenCalledWith('base64url')
    })
  })

  describe('generatePkceChallenge', () => {
    test('Should generate PKCE code verifier and challenge', () => {
      const result = generatePkceChallenge()

      expect(result).toEqual({
        codeVerifier: 'test-random-value',
        codeChallenge: 'test-hash-value'
      })
    })

    test('Should use correct crypto operations', () => {
      generatePkceChallenge()

      expect(crypto.randomBytes).toHaveBeenCalledWith(32)
      expect(crypto.createHash).toHaveBeenCalledWith('sha256')
    })

    test('Should generate base64url encoded values', () => {
      generatePkceChallenge()

      const mockToString = crypto.randomBytes.mock.results[0].value.toString
      expect(mockToString).toHaveBeenCalledWith('base64url')
    })
  })
})
