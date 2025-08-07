/**
 * Validates OAuth state parameters to prevent injection attacks
 * @param {*} state - The state parameter to validate
 * @returns {void}
 * @throws {Error} If state parameter is invalid
 */
export function validateState(state) {
  if (state === null || state === undefined || state === '') {
    throw new Error('State parameter is required')
  }

  if (typeof state !== 'string') {
    throw new Error('State parameter must be a string')
  }

  const MAX_STATE_LENGTH = 512
  if (state.length > MAX_STATE_LENGTH) {
    throw new Error('State parameter exceeds maximum length')
  }

  // Allow only alphanumeric, hyphens, and underscores
  const VALID_STATE_PATTERN = /^[a-zA-Z0-9_-]+$/
  if (!VALID_STATE_PATTERN.test(state)) {
    throw new Error('Invalid state parameter format')
  }
}
