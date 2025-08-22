import { config } from '../../config/config.js'

/**
 * Cookie manager for handling session cookies with HAPI
 * This module encapsulates HAPI-specific cookie operations
 * @module CookieManager
 */

/**
 * Sets the session cookie with proper security attributes
 * @param {Object} h - Hapi response toolkit
 * @param {string} sessionId - The session ID to store in cookie
 */
export function setSessionCookie(h, sessionId) {
  const cookieOptions = {
    ttl: config.get('session.cookie.ttl'),
    isSecure: config.get('session.cookie.secure'),
    isHttpOnly: true,
    isSameSite: 'Lax',
    path: '/',
    password: config.get('session.cookie.password'),
    encoding: 'iron'
  }

  h.state('session', sessionId, cookieOptions)
}
