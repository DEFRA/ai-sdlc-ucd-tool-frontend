import {
  testSessionStorePageHandler,
  createSessionHandler,
  getSessionHandler,
  updateSessionHandler,
  deleteSessionHandler,
  checkSessionExistsHandler,
  getSessionTtlHandler,
  refreshSessionTtlHandler,
  simulateRedisErrorHandler,
  simulateConcurrentUpdatesHandler,
  simulateSessionExpiryHandler
} from './controller.js'

export const testSessionStoreRoutes = [
  {
    method: 'GET',
    path: '/test-session-store',
    handler: testSessionStorePageHandler
  },
  {
    method: 'POST',
    path: '/test-session-store/create',
    handler: createSessionHandler
  },
  {
    method: 'GET',
    path: '/test-session-store/{sessionId}',
    handler: getSessionHandler
  },
  {
    method: 'PUT',
    path: '/test-session-store/{sessionId}',
    handler: updateSessionHandler
  },
  {
    method: 'DELETE',
    path: '/test-session-store/{sessionId}',
    handler: deleteSessionHandler
  },
  {
    method: 'GET',
    path: '/test-session-store/{sessionId}/exists',
    handler: checkSessionExistsHandler
  },
  {
    method: 'GET',
    path: '/test-session-store/{sessionId}/ttl',
    handler: getSessionTtlHandler
  },
  {
    method: 'POST',
    path: '/test-session-store/{sessionId}/refresh-ttl',
    handler: refreshSessionTtlHandler
  },
  {
    method: 'POST',
    path: '/test-session-store/simulate-redis-error',
    handler: simulateRedisErrorHandler
  },
  {
    method: 'POST',
    path: '/test-session-store/simulate-concurrent-updates',
    handler: simulateConcurrentUpdatesHandler
  },
  {
    method: 'POST',
    path: '/test-session-store/simulate-session-expiry',
    handler: simulateSessionExpiryHandler
  }
]
