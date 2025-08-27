import { vi } from 'vitest'
import { createServer } from '../server.js'
import {
  createMockRequest,
  createMockH
} from '../common/test-helpers/mock-request.js'
import { getSessionFromId } from '../authentication/authenticationService.js'
import { uploadDocumentController } from './controller.js'

// Mock the buildRedisClient function to return our mock
vi.mock('../common/helpers/redis-client.js', () => {
  const mockRedisClient = {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    on: vi.fn()
  }

  return {
    buildRedisClient: vi.fn(() => mockRedisClient),
    __mockRedisClient: mockRedisClient
  }
})

// Mock authentication service
vi.mock('../authentication/authenticationService.js', () => ({
  getSessionFromId: vi.fn()
}))

describe('#uploadDocumentController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('GET /upload-document', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test('Should display upload document interface for authenticated users', async () => {
      // Mock that getSession returns a valid session
      getSessionFromId.mockResolvedValueOnce({
        session_id: 'valid-session-id',
        session_token: 'valid-token'
      })

      // Mock request with session state (HAPI handles cookie parsing)
      const mockRequest = createMockRequest({
        state: { session: 'valid-session-id' }
      })
      const mockH = createMockH({
        view: vi.fn().mockReturnValue('upload-document-content')
      })

      // Call controller directly to test logic
      const result = await uploadDocumentController.handler(mockRequest, mockH)

      expect(mockH.view).toHaveBeenCalledWith('upload-document/index')
      expect(result).toBe('upload-document-content')
      expect(getSessionFromId).toHaveBeenCalledWith('valid-session-id')
    })

    test('Should redirect to root route when user is not authenticated', async () => {
      // Mock that getSession returns null (no valid session)
      getSessionFromId.mockResolvedValueOnce(null)

      // Mock request with session state (HAPI handles cookie parsing)
      const mockRequest = createMockRequest({
        state: { session: 'invalid-session-id' }
      })
      const mockH = createMockH()

      // Call controller directly to test logic
      const result = await uploadDocumentController.handler(mockRequest, mockH)

      expect(mockH.redirect).toHaveBeenCalledWith('/')
      expect(result).toBe('redirect-response')
      expect(getSessionFromId).toHaveBeenCalledWith('invalid-session-id')
    })

    test('Should redirect to root route when no session cookie present', async () => {
      // Mock request without session state
      const mockRequest = createMockRequest()
      const mockH = createMockH()

      // Call controller directly to test logic
      const result = await uploadDocumentController.handler(mockRequest, mockH)

      expect(mockH.redirect).toHaveBeenCalledWith('/')
      expect(result).toBe('redirect-response')
    })

    test('Should redirect to root route when session validation fails', async () => {
      // Mock that getSession throws an error (Redis connection issue)
      getSessionFromId.mockRejectedValueOnce(
        new Error('Redis connection failed')
      )

      // Mock request with session state
      const mockRequest = createMockRequest({
        state: { session: 'some-session-id' }
      })
      const mockH = createMockH()

      // Call controller directly to test logic
      const result = await uploadDocumentController.handler(mockRequest, mockH)

      expect(mockH.redirect).toHaveBeenCalledWith('/')
      expect(result).toBe('redirect-response')
      expect(getSessionFromId).toHaveBeenCalledWith('some-session-id')
    })

    test('Should validate session on every request', async () => {
      // Mock that getSession returns a valid session
      getSessionFromId.mockResolvedValueOnce({
        session_id: 'valid-session-id',
        session_token: 'valid-token'
      })

      // Mock request with session state
      const mockRequest = createMockRequest({
        state: { session: 'test-session-id' }
      })
      const mockH = createMockH({
        view: vi.fn().mockReturnValue('upload-document-content')
      })

      // Call controller directly to test logic
      await uploadDocumentController.handler(mockRequest, mockH)

      // Verify that session validation was called
      expect(getSessionFromId).toHaveBeenCalledWith('test-session-id')
      expect(getSessionFromId).toHaveBeenCalledTimes(1)
    })
  })
})
