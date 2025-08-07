import { getSession } from '../common/helpers/session-manager.js'
import { AUTHENTICATION_ROUTES } from '../common/constants/authentication-constants.js'

/**
 * Root route controller with session validation
 * Redirects to login if no valid session, otherwise to dashboard
 */
export const rootController = {
  async handler(request, h) {
    const sessionId = request.state.session

    if (!sessionId) {
      return h.redirect(AUTHENTICATION_ROUTES.LOGIN_PATH)
    }

    try {
      const session = await getSession(sessionId)

      if (!session) {
        return h.redirect(AUTHENTICATION_ROUTES.LOGIN_PATH)
      }

      return h.redirect('/upload-document')
    } catch (error) {
      request.log('error', {
        message: 'Failed to validate session',
        error: error.message
      })
      return h.redirect(AUTHENTICATION_ROUTES.LOGIN_PATH)
    }
  },
  options: {
    auth: false
  }
}
