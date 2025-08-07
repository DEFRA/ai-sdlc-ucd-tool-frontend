import { validateState } from './state-validator.js'

describe('#state-validator', () => {
  describe('validateState', () => {
    describe('valid states', () => {
      test.each([
        ['validState123', 'alphanumeric'],
        ['valid-state_123', 'with hyphens and underscores'],
        ['a'.repeat(512), 'maximum length (512 chars)']
      ])('Should accept %s (%s)', (state) => {
        expect(() => validateState(state)).not.toThrow()
      })
    })

    describe('invalid format', () => {
      test.each([
        ['state$%^&*()', 'special characters'],
        ['state@test', 'at symbol'],
        ['state#123', 'hash symbol'],
        ['state with spaces', 'spaces']
      ])('Should reject state with %s: %s', (state, description) => {
        expect(() => validateState(state)).toThrow(
          'Invalid state parameter format'
        )
      })
    })

    describe('invalid types and values', () => {
      test.each([
        [null, 'State parameter is required'],
        [undefined, 'State parameter is required'],
        ['', 'State parameter is required'],
        [123, 'State parameter must be a string'],
        [{}, 'State parameter must be a string'],
        [[], 'State parameter must be a string'],
        [true, 'State parameter must be a string']
      ])('Should reject %p with error: %s', (state, expectedError) => {
        expect(() => validateState(state)).toThrow(expectedError)
      })
    })

    test('Should reject state that exceeds maximum length', () => {
      const state = 'a'.repeat(513)
      expect(() => validateState(state)).toThrow(
        'State parameter exceeds maximum length'
      )
    })
  })
})
