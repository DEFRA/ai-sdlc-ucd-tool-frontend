import { config } from '../../config/config.js'
import { buildRedisClient } from '../common/helpers/redis-client.js'
import { OAUTH_CONSTANTS } from '../common/constants/authentication-constants.js'

const redisClient = buildRedisClient(config.get('redis'))

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
