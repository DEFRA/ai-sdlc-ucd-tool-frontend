import { vi } from 'vitest'

/**
 * Creates a mock Hapi request object with the properties needed for controller tests
 * @param {Object} options - Configuration options for the mock request
 * @param {Object} options.state - Mock request.state object (e.g., { session: 'session-id' })
 * @param {string} options.requestId - Mock request ID (defaults to 'test-request-id')
 * @param {Object} options.headers - Mock request headers (defaults to empty object)
 * @param {string} options.method - HTTP method (defaults to 'GET')
 * @returns {Object} Mock request object with log function and other required properties
 */
export function createMockRequest(options = {}) {
  const {
    state = {},
    requestId = 'test-request-id',
    headers = {},
    method = 'GET'
  } = options

  return {
    state,
    info: { id: requestId },
    headers,
    method,
    log: vi.fn()
  }
}

/**
 * Creates a mock Hapi response toolkit (h) object
 * @param {Object} options - Configuration options for the mock response toolkit
 * @returns {Object} Mock response toolkit with common methods
 */
export function createMockH(options = {}) {
  return {
    redirect: vi.fn().mockReturnValue('redirect-response'),
    view: vi.fn().mockReturnValue('view-response'),
    response: vi.fn().mockReturnValue({ code: vi.fn() }),
    ...options
  }
}
