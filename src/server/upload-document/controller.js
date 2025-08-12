import { getSession } from '../common/helpers/session-manager.js'

/**
 * Controller for handling upload document requests
 */
export const uploadDocumentController = {
  handler: async (request, h) => {
    const requestId = request.info?.id || 'unknown'
    const traceId = request.headers?.['x-trace-id'] || requestId

    request.log(['debug'], {
      level: 'DEBUG',
      message: 'Upload document route accessed',
      requestId,
      traceId,
      path: '/upload-document',
      method: request.method
    })

    try {
      // Extract session ID from cookie
      const sessionId = request.state.session

      // If no session cookie, redirect to root
      if (!sessionId) {
        request.log(['info'], {
          level: 'INFO',
          message: 'No session cookie, redirecting to root',
          requestId,
          traceId,
          decision: 'REDIRECT_TO_ROOT',
          reason: 'Missing session cookie'
        })
        return h.redirect('/')
      }

      request.log(['debug'], {
        level: 'DEBUG',
        message: 'Validating session for upload document access',
        requestId,
        traceId,
        hasSessionCookie: true
      })

      const session = await getSession(sessionId)

      // If session is invalid or expired, redirect to root
      if (!session) {
        request.log(['info'], {
          level: 'INFO',
          message: 'Invalid session, redirecting to root',
          requestId,
          traceId,
          decision: 'REDIRECT_TO_ROOT',
          reason: 'Session not found or expired'
        })
        return h.redirect('/')
      }

      request.log(['info'], {
        level: 'INFO',
        message: 'Rendering upload document page',
        requestId,
        traceId,
        decision: 'RENDER_PAGE',
        reason: 'Session validated successfully'
      })

      // Render upload document template for authenticated users
      return h.view('upload-document/index')
    } catch (error) {
      request.log(['error'], {
        level: 'ERROR',
        message: 'Error accessing upload document page',
        requestId,
        traceId,
        errorCode: 'UPLOAD_PAGE_ERROR',
        errorMessage: error.message,
        decision: 'REDIRECT_TO_ROOT',
        reason: 'Exception during page access'
      })

      // If session validation fails, redirect to root
      return h.redirect('/')
    }
  }
}
