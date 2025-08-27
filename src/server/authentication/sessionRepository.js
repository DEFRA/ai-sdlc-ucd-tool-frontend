import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { config } from '../../config/config.js'
import { buildRedisClient } from '../common/helpers/redis-client.js'

// Lazy initialize Redis client
let redisClient = null

function getRedisClient() {
  if (!redisClient) {
    redisClient = buildRedisClient(config.get('redis'))
  }
  return redisClient
}

/**
 * Creates a new session and stores it in Redis
 * Returns the session data including the session ID that should be set as a cookie
 *
 * @returns {Promise<Object>} Session data with session_id and session_token
 */
export async function createSession() {
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
      await deleteSession(sessionId)
      return null
    }

    return parsedSession
  } catch (error) {
    // Log error but don't throw - treat as session not found
    console.error('Error retrieving session:', error)
    return null
  }
}

/**
 * Deletes a session from Redis
 *
 * @param {string} sessionId - The session ID to delete
 * @returns {Promise<void>}
 */
export async function deleteSession(sessionId) {
  if (!sessionId) {
    return
  }

  try {
    const client = getRedisClient()
    const sessionKey = `session:${sessionId}`
    await client.del(sessionKey)
  } catch (error) {
    // Log error but don't throw
    console.error('Error deleting session:', error)
  }
}
