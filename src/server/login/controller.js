import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants/status-codes.js'
import {
  AUTHENTICATION_MESSAGES,
  AUTHENTICATION_ROUTES,
  HTTP_HEADER_NAMES
} from '../common/constants/authentication-constants.js'
import { createSession } from '../common/helpers/session-manager.js'

/**
 * Login controller for GET /login - displays login form
 */
export const showLoginFormController = {
  handler(_request, h) {
    return h.view('login/index', {
      pageTitle: 'Sign in'
    })
  }
}

/**
 * Login controller for POST /login - validates password.
 * Validates password against SHARED_PASSWORD environment variable.
 *
 * @param {Object} request - Hapi request object containing payload with password
 * @param {Object} h - Hapi response toolkit
 * @returns {Promise<Object>} Response with appropriate status code and headers/error message
 */
export const loginController = {
  async handler(request, h) {
    // Input validation - ensure password is provided and is a string
    const { password } = request.payload || {}

    if (!password || typeof password !== 'string' || password.trim() === '') {
      return h
        .response({
          message: AUTHENTICATION_MESSAGES.INVALID_PASSWORD
        })
        .code(statusCodes.unauthorized)
    }

    const sharedPassword = config.get('auth.sharedPassword')

    // Validate against shared password
    if (password === sharedPassword) {
      try {
        // Create session and set cookie
        await createSession(request, h)

        return h
          .response({
            message: AUTHENTICATION_MESSAGES.SUCCESS_MESSAGE
          })
          .code(statusCodes.ok)
          .header(
            HTTP_HEADER_NAMES.LOCATION,
            AUTHENTICATION_ROUTES.HOME_REDIRECT_PATH
          )
      } catch (error) {
        // If session creation fails, return error
        return h
          .response({
            message: AUTHENTICATION_MESSAGES.SERVICE_UNAVAILABLE
          })
          .code(statusCodes.internalServerError)
      }
    }

    // Standardized error response format
    return h
      .response({
        message: AUTHENTICATION_MESSAGES.INVALID_PASSWORD
      })
      .code(statusCodes.unauthorized)
  }
}
