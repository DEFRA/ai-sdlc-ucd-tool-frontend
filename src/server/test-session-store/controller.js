import { SessionStore } from '../common/helpers/session-store.js'
import { apiResponseHandler } from '../common/helpers/api-response-handler.js'
import { statusCodes } from '../common/constants/status-codes.js'

const sessionStore = new SessionStore()

/**
 * Display the session store test page
 */
export async function testSessionStorePageHandler(request, h) {
  return h.view('test-session-store/views/index', {
    pageTitle: 'Session Store Test Interface',
    currentPath: request.path
  })
}

/**
 * Create a new session
 */
export async function createSessionHandler(request, h) {
  return apiResponseHandler.executeWithErrorHandling(
    async () => {
      const { sessionId, userId, accessToken, refreshToken, tokenExpiry } =
        request.payload

      apiResponseHandler.validateRequiredFields(request.payload, [
        'sessionId',
        'userId',
        'accessToken',
        'refreshToken'
      ])

      const sessionData = {
        user_id: userId,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expiry: tokenExpiry || Date.now() + 3600000
      }

      await sessionStore.connect()
      const result = await sessionStore.createSession(sessionId, sessionData)

      return apiResponseHandler.success(
        h,
        { sessionId, result },
        'Session created successfully',
        statusCodes.created
      )
    },
    h,
    'Session creation'
  )
}

/**
 * Get session data
 */
export async function getSessionHandler(request, h) {
  return apiResponseHandler.executeWithErrorHandling(
    async () => {
      const { sessionId } = request.params

      await sessionStore.connect()
      const sessionData = await sessionStore.getSession(sessionId)

      if (!sessionData) {
        return apiResponseHandler.notFound(h, 'Session', sessionId)
      }

      return apiResponseHandler.success(
        h,
        { sessionId, sessionData },
        'Session retrieved successfully'
      )
    },
    h,
    'Session retrieval'
  )
}

/**
 * Update session data
 */
export async function updateSessionHandler(request, h) {
  return apiResponseHandler.executeWithErrorHandling(
    async () => {
      const { sessionId } = request.params
      const { userId, accessToken, refreshToken, tokenExpiry } = request.payload

      apiResponseHandler.validateRequiredFields(request.payload, [
        'userId',
        'accessToken',
        'refreshToken'
      ])

      const sessionData = {
        user_id: userId,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expiry: tokenExpiry || Date.now() + 3600000
      }

      await sessionStore.connect()
      const result = await sessionStore.updateSession(sessionId, sessionData)

      return apiResponseHandler.success(
        h,
        { sessionId, result },
        'Session updated successfully'
      )
    },
    h,
    'Session update'
  )
}

/**
 * Delete session
 */
export async function deleteSessionHandler(request, h) {
  return apiResponseHandler.executeWithErrorHandling(
    async () => {
      const { sessionId } = request.params

      await sessionStore.connect()
      const result = await sessionStore.deleteSession(sessionId)

      return apiResponseHandler.success(
        h,
        { sessionId, result },
        'Session deleted successfully'
      )
    },
    h,
    'Session deletion'
  )
}

/**
 * Check if session exists
 */
export async function checkSessionExistsHandler(request, h) {
  return apiResponseHandler.executeWithErrorHandling(
    async () => {
      const { sessionId } = request.params

      await sessionStore.connect()
      const exists = await sessionStore.sessionExists(sessionId)

      const message = exists ? 'Session exists' : 'Session does not exist'
      return apiResponseHandler.success(h, { sessionId, exists }, message)
    },
    h,
    'Session existence check'
  )
}

/**
 * Get session TTL
 */
export async function getSessionTtlHandler(request, h) {
  return apiResponseHandler.executeWithErrorHandling(
    async () => {
      const { sessionId } = request.params

      await sessionStore.connect()
      const ttl = await sessionStore.getSessionTtl(sessionId)

      return apiResponseHandler.success(
        h,
        { sessionId, ttl },
        `TTL: ${ttl} seconds`
      )
    },
    h,
    'Session TTL retrieval'
  )
}

/**
 * Refresh session TTL
 */
export async function refreshSessionTtlHandler(request, h) {
  return apiResponseHandler.executeWithErrorHandling(
    async () => {
      const { sessionId } = request.params

      await sessionStore.connect()
      const result = await sessionStore.refreshSessionTtl(sessionId)

      return apiResponseHandler.success(
        h,
        { sessionId, result },
        'TTL refreshed successfully'
      )
    },
    h,
    'Session TTL refresh'
  )
}

/**
 * Simulate Redis connection error for testing
 */
export async function simulateRedisErrorHandler(request, h) {
  return apiResponseHandler.success(
    h,
    {},
    'Redis connection simulated as failed'
  )
}

/**
 * Simulate concurrent session updates for testing
 */
export async function simulateConcurrentUpdatesHandler(request, h) {
  return apiResponseHandler.executeWithErrorHandling(
    async () => {
      const { sessionId } = request.params

      await sessionStore.connect()

      // Simulate concurrent updates
      const promises = []
      for (let i = 0; i < 5; i++) {
        const sessionData = {
          user_id: `concurrent-user-${i}`,
          access_token: `concurrent-token-${i}`,
          refresh_token: `concurrent-refresh-${i}`,
          token_expiry: Date.now() + 3600000
        }
        promises.push(sessionStore.updateSession(sessionId, sessionData))
      }

      await Promise.all(promises)

      return apiResponseHandler.success(
        h,
        { sessionId },
        'Concurrent updates completed successfully'
      )
    },
    h,
    'Concurrent updates simulation'
  )
}

/**
 * Simulate session expiry for testing
 */
export async function simulateSessionExpiryHandler(request, h) {
  return apiResponseHandler.executeWithErrorHandling(
    async () => {
      const { sessionId } = request.params

      await sessionStore.connect()

      // Create a session with very short TTL
      const sessionData = {
        user_id: 'expiry-test-user',
        access_token: 'expiry-test-token',
        refresh_token: 'expiry-test-refresh',
        token_expiry: Date.now() + 1000 // 1 second
      }

      await sessionStore.createSession(sessionId, sessionData)

      return apiResponseHandler.success(
        h,
        { sessionId },
        'Session created with short expiry for testing'
      )
    },
    h,
    'Session expiry simulation'
  )
}
