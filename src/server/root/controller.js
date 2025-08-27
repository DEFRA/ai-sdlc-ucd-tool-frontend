import { AUTHENTICATION_ROUTES } from '../common/constants/authentication-constants.js'
import { getSessionFromId } from '../authentication/authenticationService.js'

/**
 * Root route controller with session validation
 * Redirects to login if no valid session, otherwise to dashboard
 */
export const rootController = {
  async handler(request, h) {
    const requestId = request.info?.id || 'unknown'
    const traceId = request.headers?.['x-trace-id'] || requestId

    request.log(['debug'], {
      level: 'DEBUG',
      message: 'Root route accessed',
      requestId,
      traceId,
      path: '/',
      method: request.method
    })

    const sessionId = request.state.session

    if (!sessionId) {
      request.log(['info'], {
        level: 'INFO',
        message: 'No session cookie found, redirecting to login',
        requestId,
        traceId,
        decision: 'REDIRECT_TO_LOGIN',
        reason: 'Missing session cookie'
      })
      return h.redirect(AUTHENTICATION_ROUTES.LOGIN_PATH)
    }

    try {
      request.log(['debug'], {
        level: 'DEBUG',
        message: 'Validating session',
        requestId,
        traceId,
        hasSessionCookie: true
      })

      const session = await getSessionFromId(sessionId)

      if (!session) {
        request.log(['info'], {
          level: 'INFO',
          message: 'Session validation failed, redirecting to login',
          requestId,
          traceId,
          decision: 'REDIRECT_TO_LOGIN',
          reason: 'Session not found or expired'
        })
        return h.redirect(AUTHENTICATION_ROUTES.LOGIN_PATH)
      }

      request.log(['info'], {
        level: 'INFO',
        message: 'Valid session found, redirecting to upload-document',
        requestId,
        traceId,
        decision: 'REDIRECT_TO_UPLOAD',
        reason: 'Session validated successfully'
      })
      return h.redirect('/upload-document')
    } catch (error) {
      request.log(['error'], {
        level: 'ERROR',
        message: 'Session validation error occurred',
        requestId,
        traceId,
        errorCode: 'SESSION_VALIDATION_ERROR',
        errorMessage: error.message,
        decision: 'REDIRECT_TO_LOGIN',
        reason: 'Exception during session validation'
      })
      return h.redirect(AUTHENTICATION_ROUTES.LOGIN_PATH)
    }
  },
  options: {
    auth: false
  }
}
