import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { config } from '../../config/config.js'
import { buildRedisClient } from '../common/helpers/redis-client.js'
import {
  retrievePkceVerifier,
  validateStateParameter
} from '../authentication/oauth-state-storage.js'
import { exchangeCodeForTokens } from '../authentication/azure-ad-token-client.js'

// Lazy initialize Redis client
let redisClient = null

function getRedisClient() {
  if (!redisClient) {
    redisClient = buildRedisClient(config.get('redis'))
  }
  return redisClient
}

/**
 * Processes OAuth authentication callback
 * Validates state, retrieves PKCE verifier, exchanges code for tokens, and creates session data
 *
 * @param {string} code - Authorization code from OAuth provider
 * @param {string} state - State parameter for CSRF protection
 * @returns {Promise<Object>} Result object with success status, session data, and any error details
 */
export async function processAuthCallback(code, state) {
  // Validate state parameter
  const isValidState = await validateStateParameter(state)
  if (!isValidState) {
    return {
      success: false,
      error: 'INVALID_STATE',
      message: 'State validation failed'
    }
  }

  // Retrieve PKCE verifier
  const codeVerifier = await retrievePkceVerifier(state)
  if (!codeVerifier) {
    return {
      success: false,
      error: 'MISSING_PKCE',
      message: 'PKCE verifier not found'
    }
  }

  // Exchange authorization code for tokens
  await exchangeCodeForTokens(code, codeVerifier)

  // Create session data
  const sessionData = await createSessionData()

  return {
    success: true,
    sessionData
  }
}

/**
 * Creates session data and stores it in Redis
 * Returns the session data including the session ID that should be set as a cookie
 *
 * @returns {Promise<Object>} Session data with session_id and session_token
 */
async function createSessionData() {
  const sessionId = crypto.randomUUID()
  const sessionKey = `session:${sessionId}`
  const ttlSeconds = config.get('session.cache.ttl') / 1000

  // Create JWT token
  const jwtSecret = config.get('auth.jwtSecret')
  const sessionToken = jwt.sign(
    {
      session_id: sessionId,
      iat: Math.floor(Date.now() / 1000)
    },
    jwtSecret,
    { expiresIn: ttlSeconds }
  )

  // Prepare session data
  const sessionData = {
    session_id: sessionId,
    session_token: sessionToken,
    created_at: new Date().toISOString(),
    expires_at: new Date(
      Date.now() + config.get('session.cache.ttl')
    ).toISOString()
  }

  try {
    // Store session in Redis
    const client = getRedisClient()
    await client.set(sessionKey, JSON.stringify(sessionData), 'EX', ttlSeconds)

    return sessionData
  } catch (error) {
    // Clean up session if Redis storage fails
    const client = getRedisClient()
    await client.del(sessionKey).catch(() => {
      // Ignore cleanup errors
    })
    throw new Error('Session creation failed')
  }
}

/**
 * Retrieves session data from Redis by session ID
 *
 * @param {string} sessionId - The session ID to retrieve
 * @returns {Promise<Object|null>} Session data if found and valid, null otherwise
 */
export async function getSession(sessionId) {
  if (!sessionId) {
    return null
  }

  try {
    const client = getRedisClient()
    const sessionKey = `session:${sessionId}`
    const sessionData = await client.get(sessionKey)

    if (!sessionData) {
      return null
    }

    const parsedSession = JSON.parse(sessionData)

    // Check if session has expired
    const expiresAt = new Date(parsedSession.expires_at)
    if (expiresAt < new Date()) {
      // Clean up expired session
      await client.del(sessionKey).catch(() => {
        // Ignore cleanup errors
      })
      return null
    }

    return parsedSession
  } catch (error) {
    // Log error but don't throw - treat as session not found
    console.error('Error retrieving session:', error)
    return null
  }
}
