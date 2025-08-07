import crypto from 'crypto'

/**
 * Generates a cryptographically secure state parameter for CSRF protection
 * @returns {string} A random state parameter
 */
export function generateStateParameter() {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Generates PKCE code verifier and challenge
 * @returns {Object} Object containing codeVerifier and codeChallenge
 */
export function generatePkceChallenge() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  return {
    codeVerifier,
    codeChallenge
  }
}
