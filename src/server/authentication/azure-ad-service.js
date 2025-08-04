import crypto from 'crypto'
import { config } from '../../config/config.js'
import { buildRedisClient } from '../common/helpers/redis-client.js'
import { OAUTH_CONSTANTS } from '../common/constants/authentication-constants.js'

const redisClient = buildRedisClient(config.get('redis'))

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

/**
 * Stores the state parameter in Redis with TTL
 * @param {string} state - The state parameter to store
 * @returns {Promise<void>}
 */
export async function storeStateParameter(state) {
  const key = `${OAUTH_CONSTANTS.STATE_KEY_PREFIX}${state}`
  await redisClient.set(key, '1', 'EX', OAUTH_CONSTANTS.STATE_TTL_SECONDS)
}

/**
 * Stores the PKCE code verifier in Redis with TTL
 * @param {string} state - The state parameter to associate with the code verifier
 * @param {string} codeVerifier - The PKCE code verifier to store
 * @returns {Promise<void>}
 */
export async function storePkceVerifier(state, codeVerifier) {
  const key = `${OAUTH_CONSTANTS.PKCE_KEY_PREFIX}${state}`
  await redisClient.set(
    key,
    codeVerifier,
    'EX',
    OAUTH_CONSTANTS.STATE_TTL_SECONDS
  )
}

/**
 * Validates a state parameter exists in Redis
 * @param {string} state - The state parameter to validate
 * @returns {Promise<boolean>} True if valid, false otherwise
 */
export async function validateStateParameter(state) {
  const key = `${OAUTH_CONSTANTS.STATE_KEY_PREFIX}${state}`
  const exists = await redisClient.exists(key)

  // Delete the state after validation to prevent reuse
  if (exists) {
    await redisClient.del(key)
  }

  return exists === 1
}

/**
 * Retrieves and removes the PKCE code verifier from Redis
 * @param {string} state - The state parameter associated with the code verifier
 * @returns {Promise<string|null>} The code verifier or null if not found
 */
export async function retrievePkceVerifier(state) {
  const key = `${OAUTH_CONSTANTS.PKCE_KEY_PREFIX}${state}`
  const codeVerifier = await redisClient.get(key)

  // Delete the verifier after retrieval to prevent reuse
  if (codeVerifier) {
    await redisClient.del(key)
  }

  return codeVerifier
}

/**
 * Builds the Azure AD authorization URL
 * @param {string} state - The state parameter for CSRF protection
 * @param {string} codeChallenge - The PKCE code challenge
 * @returns {string} The complete authorization URL
 */
export function buildAuthorizationUrl(state, codeChallenge) {
  const baseUrl = config.get('azureAd.baseUrl')
  const clientId = config.get('azureAd.clientId')
  const redirectUri = config.get('azureAd.redirectUri')
  const tenantId = config.get('azureAd.tenantId')
  const authorizeEndpoint = config.get('azureAd.authorizeEndpoint')

  if (
    !baseUrl ||
    !clientId ||
    !redirectUri ||
    !tenantId ||
    !authorizeEndpoint
  ) {
    throw new Error('Azure AD configuration is incomplete')
  }

  const fullAuthorizeUrl = `${baseUrl}/${tenantId}/${authorizeEndpoint}`

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: OAUTH_CONSTANTS.RESPONSE_TYPE,
    redirect_uri: redirectUri,
    response_mode: OAUTH_CONSTANTS.RESPONSE_MODE,
    scope: OAUTH_CONSTANTS.SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: OAUTH_CONSTANTS.CODE_CHALLENGE_METHOD
  })

  return `${fullAuthorizeUrl}?${params.toString()}`
}

/**
 * Exchanges authorization code for access and refresh tokens
 * @param {string} code - The authorization code from Azure AD
 * @param {string} codeVerifier - The PKCE code verifier
 * @returns {Promise<Object>} Token response containing access_token, refresh_token, id_token
 */
export async function exchangeCodeForTokens(code, codeVerifier) {
  const baseUrl = config.get('azureAd.baseUrl')
  const clientId = config.get('azureAd.clientId')
  const clientSecret = config.get('azureAd.clientSecret')
  const redirectUri = config.get('azureAd.redirectUri')
  const tenantId = config.get('azureAd.tenantId')
  const tokenEndpoint = config.get('azureAd.tokenEndpoint')

  if (
    !baseUrl ||
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    !tenantId ||
    !tokenEndpoint
  ) {
    throw new Error('Azure AD configuration is incomplete')
  }

  const fullTokenUrl = `${baseUrl}/${tenantId}/${tokenEndpoint}`

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  })

  const response = await fetch(fullTokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`)
  }

  return await response.json()
}
