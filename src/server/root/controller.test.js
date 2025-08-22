import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rootController } from './controller.js'
import { AUTHENTICATION_ROUTES } from '../common/constants/authentication-constants.js'
import { getSession } from '../login/authCallbackService.js'

vi.mock('../common/helpers/session-manager.js')
vi.mock('../login/authCallbackService.js')

describe('rootController', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    mockRequest = {
      state: {},
      log: vi.fn(),
      info: { id: 'test-request-id' },
      headers: {}
    }
    mockH = {
      redirect: vi.fn()
    }
    vi.clearAllMocks()
  })

  describe('handler', () => {
    it('should redirect to login when no session cookie exists', async () => {
      mockRequest.state.session = undefined

      await rootController.handler(mockRequest, mockH)

      expect(mockH.redirect).toHaveBeenCalledWith(
        AUTHENTICATION_ROUTES.LOGIN_PATH
      )
      expect(getSession).not.toHaveBeenCalled()
    })

    it('should redirect to login when session is not found in Redis', async () => {
      mockRequest.state.session = 'test-session-id'
      getSession.mockResolvedValue(null)

      await rootController.handler(mockRequest, mockH)

      expect(getSession).toHaveBeenCalledWith('test-session-id')
      expect(mockH.redirect).toHaveBeenCalledWith(
        AUTHENTICATION_ROUTES.LOGIN_PATH
      )
    })

    it('should redirect to upload-document when session is valid', async () => {
      mockRequest.state.session = 'test-session-id'
      const validSession = {
        session_id: 'test-session-id',
        expires_at: new Date(Date.now() + 3600000).toISOString()
      }
      getSession.mockResolvedValue(validSession)

      await rootController.handler(mockRequest, mockH)

      expect(getSession).toHaveBeenCalledWith('test-session-id')
      expect(mockH.redirect).toHaveBeenCalledWith('/upload-document')
    })

    it('should handle session validation errors gracefully', async () => {
      mockRequest.state.session = 'test-session-id'
      getSession.mockRejectedValue(new Error('Redis connection failed'))

      await rootController.handler(mockRequest, mockH)

      expect(getSession).toHaveBeenCalledWith('test-session-id')
      expect(mockRequest.log).toHaveBeenCalledWith(['error'], {
        level: 'ERROR',
        message: 'Session validation error occurred',
        requestId: 'test-request-id',
        traceId: 'test-request-id',
        errorCode: 'SESSION_VALIDATION_ERROR',
        errorMessage: 'Redis connection failed',
        decision: 'REDIRECT_TO_LOGIN',
        reason: 'Exception during session validation'
      })
      expect(mockH.redirect).toHaveBeenCalledWith(
        AUTHENTICATION_ROUTES.LOGIN_PATH
      )
    })
  })

  describe('options', () => {
    it('should have auth disabled', () => {
      expect(rootController.options.auth).toBe(false)
    })
  })
})
