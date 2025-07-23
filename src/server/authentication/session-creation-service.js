import jwt from 'jsonwebtoken'
import { config } from '../../config/config.js'
import { redisClient } from '../common/helpers/redis-client.js'

/**
 * Session Creation Service for F1S3
 * Creates authenticated sessions with JWT tokens stored in Redis
 */

/**
 * Creates an authenticated session with unique ID and JWT token
 * @returns {Promise<Object>} Session creation result
 */
export async function createAuthenticatedSession() {
  try {
    // Generate cryptographically secure session ID
    const { randomBytes } = await import('crypto')
    const sessionId = randomBytes(32).toString('hex')

    // Get configuration values
    const jwtSecret = config.get('auth.jwtSecret')
    const sessionTtl = config.get('auth.session.ttl')

    // Create JWT token with session_id claim
    const now = Math.floor(Date.now() / 1000)
    const sessionToken = jwt.sign(
      {
        session_id: sessionId,
        iat: now,
        exp: now + sessionTtl
      },
      jwtSecret,
      { algorithm: 'HS256' }
    )

    // Create session data with all required fields
    const currentTime = new Date()
    const sessionData = {
      session_id: sessionId,
      session_token: sessionToken,
      created_at: currentTime.toISOString(),
      expires_at: new Date(
        currentTime.getTime() + sessionTtl * 1000
      ).toISOString()
    }

    // Store session in Redis with atomic expiry
    await redisClient.setEx(
      `session:${sessionId}`,
      sessionTtl,
      JSON.stringify(sessionData)
    )

    // Return success response
    return {
      sessionId,
      sessionToken,
      success: true
    }
  } catch (error) {
    // Handle Redis unavailability with service error
    return {
      success: false,
      error:
        'Service temporarily unavailable. Please try again in a few moments.'
    }
  }
}
