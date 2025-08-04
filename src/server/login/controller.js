import {
  AUTHENTICATION_MESSAGES,
  AUTHENTICATION_ROUTES
} from '../common/constants/authentication-constants.js'
import { createSession, getSession } from '../common/helpers/session-manager.js'
import {
  generateStateParameter,
  storeStateParameter,
  generatePkceChallenge,
  storePkceVerifier,
  buildAuthorizationUrl,
  validateStateParameter,
  retrievePkceVerifier,
  exchangeCodeForTokens
} from '../authentication/azure-ad-service.js'

/**
 * Login controller for GET /login - redirects to Azure AD
 */
export const showLoginFormController = {
  async handler(request, h) {
    // Check if user already has a valid session
    const sessionId = request.state.session
    if (sessionId) {
      const session = await getSession(sessionId)
      if (session) {
        // User already authenticated, redirect to home
        return h.redirect(AUTHENTICATION_ROUTES.HOME_REDIRECT_PATH)
      }
    }

    try {
      // Generate state parameter for CSRF protection
      const state = generateStateParameter()

      // Generate PKCE challenge and verifier
      const { codeVerifier, codeChallenge } = generatePkceChallenge()

      // Store state and PKCE verifier in Redis
      await storeStateParameter(state)
      await storePkceVerifier(state, codeVerifier)

      // Build authorization URL with PKCE
      const authorizationUrl = buildAuthorizationUrl(state, codeChallenge)

      // Redirect to Azure AD
      return h.redirect(authorizationUrl)
    } catch (error) {
      // Handle Azure AD configuration errors
      return h.view('login/index', {
        pageTitle: 'Sign in',
        errorMessage: AUTHENTICATION_MESSAGES.AZURE_AD_UNAVAILABLE,
        hasError: true
      })
    }
  }
}

/**
 * OAuth callback controller for GET /auth/callback - handles Azure AD callback
 */
export const authCallbackController = {
  async handler(request, h) {
    const { code, state, error } = request.query

    // Handle OAuth errors from Azure AD
    if (error) {
      return h.view('login/index', {
        pageTitle: 'Sign in',
        errorMessage: AUTHENTICATION_MESSAGES.AZURE_AD_UNAVAILABLE,
        hasError: true
      })
    }

    // Validate required parameters
    if (!code || !state) {
      return h.view('login/index', {
        pageTitle: 'Sign in',
        errorMessage: AUTHENTICATION_MESSAGES.INVALID_AUTHENTICATION_RESPONSE,
        hasError: true
      })
    }

    try {
      // Validate state parameter for CSRF protection
      const isValidState = await validateStateParameter(state)
      if (!isValidState) {
        return h.view('login/index', {
          pageTitle: 'Sign in',
          errorMessage: AUTHENTICATION_MESSAGES.AUTHENTICATION_REQUEST_EXPIRED,
          hasError: true
        })
      }

      // Retrieve PKCE code verifier
      const codeVerifier = await retrievePkceVerifier(state)
      if (!codeVerifier) {
        return h.view('login/index', {
          pageTitle: 'Sign in',
          errorMessage: AUTHENTICATION_MESSAGES.AUTHENTICATION_REQUEST_EXPIRED,
          hasError: true
        })
      }

      // Exchange authorization code for tokens
      await exchangeCodeForTokens(code, codeVerifier)

      // Create session for authenticated user
      await createSession(request, h)

      // Redirect to home page
      return h.redirect(AUTHENTICATION_ROUTES.HOME_REDIRECT_PATH)
    } catch (error) {
      request.logger.error('OAuth callback error:', error)

      return h.view('login/index', {
        pageTitle: 'Sign in',
        errorMessage: AUTHENTICATION_MESSAGES.AUTHENTICATION_FAILED,
        hasError: true
      })
    }
  }
}
