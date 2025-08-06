import { getSession } from '../common/helpers/session-manager.js'

/**
 * Controller for handling upload document requests
 */
export const uploadDocumentController = {
  handler: async (request, h) => {
    try {
      // Extract session ID from cookie
      const sessionId = request.state.session

      // If no session cookie, redirect to root
      if (!sessionId) {
        return h.redirect('/')
      }

      // Validate session
      const session = await getSession(sessionId)

      // If session is invalid, redirect to root
      if (!session) {
        return h.redirect('/')
      }

      // Render upload document template for authenticated users
      return h.view('upload-document/index')
    } catch (error) {
      // If session validation fails, redirect to root
      return h.redirect('/')
    }
  }
}
