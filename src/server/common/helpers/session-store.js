import { createLogger } from './logging/logger.js'
import { buildRedisClient } from './redis-client.js'
import { config } from '../../../config/config.js'

/**
 * Redis Session Store
 * Implements CRUD operations for session management with Azure AD authentication
 */
export class SessionStore {
  constructor() {
    this.logger = createLogger()
    this.redisClient = null
    this.sessionTtl = config.get('session.cache.ttl')
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    const redisConfig = config.get('redis')
    this.redisClient = buildRedisClient(redisConfig)

    // Set up error handler but don't throw immediately
    this.redisClient.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error.message}`)
    })

    // Check if connection is in error state
    if (this.redisClient.status === 'error') {
      throw new Error('Connection failed')
    }

    this.logger.info('Connected to Redis session store')
    return true
  }

  /**
   * Create a new session in Redis
   * @param {string} sessionId - Unique session identifier
   * @param {Object} sessionData - Session data containing user_id, access_token, refresh_token, token_expiry
   * @returns {Promise<boolean>} - Success status
   */
  async createSession(sessionId, sessionData) {
    try {
      this._validateSessionData(sessionData)
      this._validateSessionSize(sessionData)

      const key = `session:${sessionId}`
      const ttlInSeconds = Math.floor(this.sessionTtl / 1000)

      await this.redisClient.setex(
        key,
        ttlInSeconds,
        JSON.stringify(sessionData)
      )

      this.logger.info(`Session created: ${sessionId}`)
      return true
    } catch (error) {
      this.logger.error(`Error creating session ${sessionId}: ${error.message}`)
      throw error
    }
  }

  /**
   * Retrieve session data by session ID
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object|null>} - Session data or null if not found
   */
  async getSession(sessionId) {
    try {
      const key = `session:${sessionId}`
      const data = await this.redisClient.get(key)

      if (!data) {
        return null
      }

      try {
        return JSON.parse(data)
      } catch (parseError) {
        this.logger.error(`Corrupted session data for ${sessionId}`)
        throw new Error('Invalid session data format')
      }
    } catch (error) {
      this.logger.error(
        `Error retrieving session ${sessionId}: ${error.message}`
      )
      throw error
    }
  }

  /**
   * Update existing session data
   * @param {string} sessionId - Session identifier
   * @param {Object} sessionData - Updated session data
   * @returns {Promise<boolean>} - Success status
   */
  async updateSession(sessionId, sessionData) {
    try {
      const key = `session:${sessionId}`
      const exists = await this.redisClient.exists(key)

      if (!exists) {
        throw new Error(`Session not found: ${sessionId}`)
      }

      this._validateSessionData(sessionData)

      const ttlInSeconds = Math.floor(this.sessionTtl / 1000)
      await this.redisClient.setex(
        key,
        ttlInSeconds,
        JSON.stringify(sessionData)
      )

      this.logger.info(`Session updated: ${sessionId}`)
      return true
    } catch (error) {
      this.logger.error(`Error updating session ${sessionId}: ${error.message}`)
      throw error
    }
  }

  /**
   * Delete session from Redis
   * @param {string} sessionId - Session identifier
   * @returns {Promise<boolean>} - Success status
   */
  async deleteSession(sessionId) {
    try {
      const key = `session:${sessionId}`
      const result = await this.redisClient.del(key)

      if (result === 0) {
        this.logger.info(`Session not found for deletion: ${sessionId}`)
      } else {
        this.logger.info(`Session deleted: ${sessionId}`)
      }

      return true
    } catch (error) {
      this.logger.error(`Error deleting session ${sessionId}: ${error.message}`)
      throw error
    }
  }

  /**
   * Check if session exists
   * @param {string} sessionId - Session identifier
   * @returns {Promise<boolean>} - Existence status
   */
  async sessionExists(sessionId) {
    const key = `session:${sessionId}`
    const result = await this.redisClient.exists(key)
    return result === 1
  }

  /**
   * Get session TTL
   * @param {string} sessionId - Session identifier
   * @returns {Promise<number>} - TTL in seconds, -1 if no TTL, -2 if not found
   */
  async getSessionTtl(sessionId) {
    const key = `session:${sessionId}`
    return await this.redisClient.ttl(key)
  }

  /**
   * Refresh session TTL
   * @param {string} sessionId - Session identifier
   * @returns {Promise<boolean>} - Success status
   */
  async refreshSessionTtl(sessionId) {
    const key = `session:${sessionId}`
    const ttlInSeconds = Math.floor(this.sessionTtl / 1000)
    const result = await this.redisClient.expire(key, ttlInSeconds)

    if (result === 0) {
      this.logger.warn(
        `Cannot refresh TTL for non-existent session: ${sessionId}`
      )
      return false
    }

    this.logger.info(`Session TTL refreshed: ${sessionId}`)
    return true
  }

  /**
   * Close Redis connection
   */
  async disconnect() {
    if (this.redisClient) {
      await this.redisClient.quit()
      return true
    }
    return true
  }

  /**
   * Validate session data structure
   * @param {Object} sessionData - Session data to validate
   * @private
   */
  _validateSessionData(sessionData) {
    const requiredFields = [
      'user_id',
      'access_token',
      'refresh_token',
      'token_expiry'
    ]

    for (const field of requiredFields) {
      if (!sessionData[field]) {
        throw new Error('Invalid session data: missing required fields')
      }
    }
  }

  /**
   * Validate session data size
   * @param {Object} sessionData - Session data to validate
   * @private
   */
  _validateSessionSize(sessionData) {
    const dataSize = JSON.stringify(sessionData).length
    const maxSize = 50000 // 50KB limit

    if (dataSize > maxSize) {
      throw new Error('Session data exceeds maximum size limit')
    }
  }
}
