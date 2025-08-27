import {
  retrievePkceVerifier,
  storePkceVerifier,
  storeStateParameter,
  validateStateParameter
} from './oauth-state-storage.js'
import { exchangeCodeForTokens } from './azure-ad-token-client.js'
import { createSession, getSession } from './sessionRepository.js'
import {
  generatePkceChallenge,
  generateStateParameter
} from './oauth-crypto-service.js'
import { buildAuthorizationUrl } from './azure-ad-url-builder.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

/**
 * Initiates OAuth flow by generating security parameters and building authorization URL
 * Generates state and PKCE parameters, stores them securely, and returns the authorization URL
 *
 * @returns {Promise<string>} The authorization URL to redirect the user to
 * @throws {Error} If unable to generate security parameters or build URL
 */
export async function initiateOauthFlow() {
  const state = generateStateParameter()
  const { codeVerifier, codeChallenge } = generatePkceChallenge()

  await storeStateParameter(state)
  await storePkceVerifier(state, codeVerifier)

  return buildAuthorizationUrl(state, codeChallenge)
}

/**
 * Authenticates user with OAuth callback parameters
 * Validates state, retrieves PKCE verifier, exchanges code for tokens, and creates session data
 *
 * @param {string} code - Authorization code from OAuth provider
 * @param {string} state - State parameter for CSRF protection
 * @returns {Promise<Object>} Session data object
 * @throws {Error} If state validation fails, PKCE verifier not found, or authentication fails
 */
export async function authenticateWithCallback(code, state) {
  logger.debug({
    message: 'Starting OAuth callback authentication',
    hasCode: !!code,
    hasState: !!state
  })

  // Validate state parameter
  const isValidState = await validateStateParameter(state)
  if (!isValidState) {
    logger.error({
      message: 'OAuth state validation failed',
      errorCode: 'INVALID_STATE'
    })
    const error = new Error('State validation failed')
    error.code = 'INVALID_STATE'
    throw error
  }

  // Retrieve PKCE verifier
  const codeVerifier = await retrievePkceVerifier(state)
  if (!codeVerifier) {
    logger.error({
      message: 'PKCE verifier not found for state parameter',
      errorCode: 'MISSING_PKCE'
    })
    const error = new Error('PKCE verifier not found')
    error.code = 'MISSING_PKCE'
    throw error
  }

  try {
    // Exchange authorization code for tokens
    await exchangeCodeForTokens(code, codeVerifier)
    logger.debug({ message: 'Token exchange completed successfully' })

    // Create and return session data
    const sessionData = await createSession()
    logger.info({
      message: 'OAuth authentication completed successfully',
      sessionCreated: true
    })
    return sessionData
  } catch (error) {
    logger.error({
      message: 'OAuth authentication failed',
      errorMessage: error.message,
      errorCode: 'TOKEN_EXCHANGE_FAILED'
    })
    throw error
  }
}

/**
 * Retrieves session data from Redis by session ID
 * Delegates to the session repository
 *
 * @param {string} sessionId - The session ID to retrieve
 * @returns {Promise<Object|null>} Session data if found and valid, null otherwise
 */
export async function getSessionFromId(sessionId) {
  return getSession(sessionId)
}
