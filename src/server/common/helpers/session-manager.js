import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { config } from '../../../config/config.js'
import { buildRedisClient } from './redis-client.js'

/**
 * Session manager for creating, storing, and managing user sessions
 * @module SessionManager
 */

// Initialize Redis client
const redisClient = buildRedisClient(config.get('redis'))

/**
 * Creates a new session for the authenticated user
 * @param {Object} request - Hapi request object
 * @param {Object} h - Hapi response toolkit
 * @returns {Promise<Object>} Session data with token
 */
export async function createSession(request, h) {
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
    await redisClient.set(
      sessionKey,
      JSON.stringify(sessionData),
      'EX',
      ttlSeconds
    )

    // Set HTTP-only secure cookie with session ID
    setCookieWithSessionId(h, sessionId)

    return sessionData
  } catch (error) {
    // Clean up session if Redis storage fails
    await redisClient.del(sessionKey).catch(() => {
      // Ignore cleanup errors
    })
    throw new Error('Session creation failed')
  }
}

/**
 * Sets the session cookie with proper security attributes
 * @param {Object} h - Hapi response toolkit
 * @param {string} sessionId - The session ID to store in cookie
 */
function setCookieWithSessionId(h, sessionId) {
  const cookieOptions = {
    ttl: config.get('session.cookie.ttl'),
    isSecure: config.get('session.cookie.secure'),
    isHttpOnly: true,
    isSameSite: 'Strict',
    path: '/',
    password: config.get('session.cookie.password'),
    encoding: 'iron'
  }

  h.state('session', sessionId, cookieOptions)
}

/**
 * Retrieves and validates session data from Redis
 * @param {string} sessionId - The session ID
 * @returns {Promise<Object|null>} Session data if valid and not expired, null otherwise
 */
export async function getSession(sessionId) {
  if (!sessionId) {
    return null
  }

  try {
    const sessionKey = `session:${sessionId}`
    const sessionData = await redisClient.get(sessionKey)

    if (!sessionData) {
      return null
    }

    const session = JSON.parse(sessionData)

    // Check if session has a valid expires_at field
    if (!session.expires_at) {
      return null
    }

    // Check if session has expired
    const now = new Date()
    const expiresAt = new Date(session.expires_at)

    // Check if the expires_at date is invalid
    if (isNaN(expiresAt.getTime())) {
      return null
    }

    if (now >= expiresAt) {
      return null
    }

    return session
  } catch (error) {
    return null
  }
}

/**
 * Deletes a session from Redis and clears the cookie
 * @param {string} sessionId - The session ID to delete
 * @param {Object} h - Hapi response toolkit for clearing cookie
 * @returns {Promise<number>} Number of keys deleted
 */
export async function deleteSession(sessionId, h = null) {
  const sessionKey = `session:${sessionId}`

  try {
    const result = await redisClient.del(sessionKey)

    // Clear session cookie if response toolkit provided
    if (h) {
      clearSessionCookie(h)
    }

    return result
  } catch (error) {
    // Still clear cookie even if Redis deletion fails
    if (h) {
      clearSessionCookie(h)
    }
    throw error
  }
}

/**
 * Clears the session cookie
 * @param {Object} h - Hapi response toolkit
 */
function clearSessionCookie(h) {
  h.unstate('session')
}
