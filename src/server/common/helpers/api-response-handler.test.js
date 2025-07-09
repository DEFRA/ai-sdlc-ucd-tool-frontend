import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ApiResponseHandler } from './api-response-handler.js'
import { statusCodes } from '../constants/status-codes.js'

vi.mock('./logging/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }))
}))

describe('ApiResponseHandler', () => {
  let apiResponseHandler
  let mockLogger
  let mockH

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    apiResponseHandler = new ApiResponseHandler()
    apiResponseHandler.logger = mockLogger
    vi.clearAllMocks()
  })

  describe('success', () => {
    test('should return success response with default values', () => {
      apiResponseHandler.success(mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        message: 'Operation successful'
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    test('should return success response with custom data and message', () => {
      const data = { userId: '123', sessionId: 'abc' }
      const message = 'Custom success message'

      apiResponseHandler.success(mockH, data, message, 201)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        message,
        userId: '123',
        sessionId: 'abc'
      })
      expect(mockH.code).toHaveBeenCalledWith(201)
    })
  })

  describe('error', () => {
    test('should return error response and log error', () => {
      const error = new Error('Test error')
      const context = 'Test context'

      apiResponseHandler.error(mockH, error, context, 500)

      expect(mockLogger.error).toHaveBeenCalledWith(
        `${context}: ${error.message}`,
        { error: error.stack }
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        message: 'Error: Test error',
        error: 'Test error'
      })
      expect(mockH.code).toHaveBeenCalledWith(500)
    })

    test('should use default context and status code', () => {
      const error = new Error('Test error')

      apiResponseHandler.error(mockH, error)

      expect(mockLogger.error).toHaveBeenCalledWith('API Error: Test error', {
        error: error.stack
      })
      expect(mockH.code).toHaveBeenCalledWith(500)
    })
  })

  describe('notFound', () => {
    test('should return not found response', () => {
      apiResponseHandler.notFound(mockH, 'Session', '123')

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        message: 'Session not found',
        sessionId: '123'
      })
      expect(mockH.code).toHaveBeenCalledWith(statusCodes.notFound)
    })

    test('should handle different resource types', () => {
      apiResponseHandler.notFound(mockH, 'User', 'user-456')

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
        userId: 'user-456'
      })
    })
  })

  describe('validationError', () => {
    test('should return validation error response', () => {
      const message = 'Invalid input data'

      apiResponseHandler.validationError(mockH, message)

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        message: 'Error: Invalid input data',
        error: 'Invalid input data'
      })
      expect(mockH.code).toHaveBeenCalledWith(statusCodes.badRequest)
    })
  })

  describe('executeWithErrorHandling', () => {
    test('should execute operation successfully', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success result')
      const context = 'Test operation'

      const result = await apiResponseHandler.executeWithErrorHandling(
        mockOperation,
        mockH,
        context
      )

      expect(mockOperation).toHaveBeenCalled()
      expect(result).toBe('success result')
      expect(mockLogger.error).not.toHaveBeenCalled()
    })

    test('should handle operation errors', async () => {
      const error = new Error('Operation failed')
      const mockOperation = vi.fn().mockRejectedValue(error)
      const context = 'Test operation'

      await apiResponseHandler.executeWithErrorHandling(
        mockOperation,
        mockH,
        context
      )

      expect(mockOperation).toHaveBeenCalled()
      expect(mockLogger.error).toHaveBeenCalledWith(
        `${context}: ${error.message}`,
        { error: error.stack }
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        message: 'Error: Operation failed',
        error: 'Operation failed'
      })
    })
  })

  describe('validateRequiredFields', () => {
    test('should pass validation with all required fields', () => {
      const payload = {
        sessionId: '123',
        userId: '456',
        accessToken: 'token'
      }
      const requiredFields = ['sessionId', 'userId', 'accessToken']

      expect(() => {
        apiResponseHandler.validateRequiredFields(payload, requiredFields)
      }).not.toThrow()
    })

    test('should throw error for missing required fields', () => {
      const payload = {
        sessionId: '123'
      }
      const requiredFields = ['sessionId', 'userId', 'accessToken']

      expect(() => {
        apiResponseHandler.validateRequiredFields(payload, requiredFields)
      }).toThrow(
        'Invalid session data: missing required fields: userId, accessToken'
      )
    })

    test('should throw error for empty string values', () => {
      const payload = {
        sessionId: '123',
        userId: '',
        accessToken: 'token'
      }
      const requiredFields = ['sessionId', 'userId', 'accessToken']

      expect(() => {
        apiResponseHandler.validateRequiredFields(payload, requiredFields)
      }).toThrow('Invalid session data: missing required fields: userId')
    })

    test('should throw error for null values', () => {
      const payload = {
        sessionId: '123',
        userId: null,
        accessToken: 'token'
      }
      const requiredFields = ['sessionId', 'userId', 'accessToken']

      expect(() => {
        apiResponseHandler.validateRequiredFields(payload, requiredFields)
      }).toThrow('Invalid session data: missing required fields: userId')
    })
  })
})
