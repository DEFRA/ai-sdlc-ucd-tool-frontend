import { createLogger } from './logging/logger.js'
import { statusCodes } from '../constants/status-codes.js'

/**
 * API Response Handler
 * Standardizes API response formats and error handling
 */
export class ApiResponseHandler {
  constructor() {
    this.logger = createLogger()
  }

  /**
   * Handle successful API response
   * @param {Object} h - Hapi response toolkit
   * @param {Object} data - Response data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code (default: 200)
   * @returns {Object} Hapi response object
   */
  success(h, data = {}, message = 'Operation successful', statusCode = 200) {
    const response = {
      success: true,
      message,
      ...data
    }

    return h.response(response).code(statusCode)
  }

  /**
   * Handle API error response
   * @param {Object} h - Hapi response toolkit
   * @param {Error} error - Error object
   * @param {string} context - Error context for logging
   * @param {number} statusCode - HTTP status code (default: 500)
   * @returns {Object} Hapi response object
   */
  error(h, error, context = 'API Error', statusCode = 500) {
    this.logger.error(`${context}: ${error.message}`, { error: error.stack })

    const response = {
      success: false,
      message: `Error: ${error.message}`,
      error: error.message
    }

    return h.response(response).code(statusCode)
  }

  /**
   * Handle not found response
   * @param {Object} h - Hapi response toolkit
   * @param {string} resource - Resource name
   * @param {string} identifier - Resource identifier
   * @returns {Object} Hapi response object
   */
  notFound(h, resource, identifier) {
    const message = `${resource} not found`
    const response = {
      success: false,
      message,
      [resource.toLowerCase() + 'Id']: identifier
    }

    return h.response(response).code(statusCodes.notFound)
  }

  /**
   * Handle validation error response
   * @param {Object} h - Hapi response toolkit
   * @param {string} message - Validation error message
   * @returns {Object} Hapi response object
   */
  validationError(h, message) {
    const response = {
      success: false,
      message: `Error: ${message}`,
      error: message
    }

    return h.response(response).code(statusCodes.badRequest)
  }

  /**
   * Execute async operation with error handling
   * @param {Function} operation - Async operation to execute
   * @param {Object} h - Hapi response toolkit
   * @param {string} context - Error context for logging
   * @returns {Promise<Object>} Response object
   */
  async executeWithErrorHandling(operation, h, context) {
    try {
      return await operation()
    } catch (error) {
      return this.error(h, error, context)
    }
  }

  /**
   * Validate required fields in request payload
   * @param {Object} payload - Request payload
   * @param {Array<string>} requiredFields - Required field names
   * @throws {Error} When required fields are missing
   */
  validateRequiredFields(payload, requiredFields) {
    const missingFields = requiredFields.filter((field) => !payload[field])

    if (missingFields.length > 0) {
      throw new Error(
        `Invalid session data: missing required fields: ${missingFields.join(', ')}`
      )
    }
  }
}

/**
 * Create singleton instance
 */
export const apiResponseHandler = new ApiResponseHandler()
