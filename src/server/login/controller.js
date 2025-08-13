import {
  AUTHENTICATION_MESSAGES,
  AUTHENTICATION_ROUTES
} from '../common/constants/authentication-constants.js'
import { createSession, getSession } from '../common/helpers/session-manager.js'
import {
  generateStateParameter,
  generatePkceChallenge
} from '../authentication/oauth-crypto-service.js'
import {
  storeStateParameter,
  storePkceVerifier,
  validateStateParameter,
  retrievePkceVerifier
} from '../authentication/oauth-state-storage.js'
import { buildAuthorizationUrl } from '../authentication/azure-ad-url-builder.js'
import { exchangeCodeForTokens } from '../authentication/azure-ad-token-client.js'

/**
 * Login controller for GET /login - redirects to Azure AD
 */
export const showLoginFormController = {
  async handler(request, h) {
    const requestId = request.info?.id || 'unknown'
    const traceId = request.headers?.['x-trace-id'] || requestId

    request.log(['debug'], {
      level: 'DEBUG',
      message: 'Login route accessed',
      requestId,
      traceId,
      path: '/login',
      method: request.method
    })

    // Check if user already has a valid session
    const sessionId = request.state.session
    if (sessionId) {
      request.log(['debug'], {
        level: 'DEBUG',
        message: 'Checking existing session before login',
        requestId,
        traceId,
        hasSessionCookie: true
      })

      const session = await getSession(sessionId)
      if (session) {
        // User already authenticated, redirect to home
        request.log(['info'], {
          level: 'INFO',
          message: 'User already authenticated, redirecting to home',
          requestId,
          traceId,
          decision: 'REDIRECT_TO_HOME',
          reason: 'Valid session exists'
        })
        return h.redirect(AUTHENTICATION_ROUTES.HOME_REDIRECT_PATH)
      }
    }

    try {
      request.log(['debug'], {
        level: 'DEBUG',
        message: 'Initiating OAuth flow',
        requestId,
        traceId,
        authMethod: 'oauth2',
        provider: 'azure-ad'
      })

      // Generate state parameter for CSRF protection
      const state = generateStateParameter()

      // Generate PKCE challenge and verifier
      const { codeVerifier, codeChallenge } = generatePkceChallenge()

      request.log(['debug'], {
        level: 'DEBUG',
        message: 'OAuth security parameters generated',
        requestId,
        traceId,
        hasState: true,
        hasPkce: true
      })

      // Store state and PKCE verifier in Redis
      await storeStateParameter(state)
      await storePkceVerifier(state, codeVerifier)

      // Build authorization URL with PKCE
      const authorizationUrl = buildAuthorizationUrl(state, codeChallenge)

      request.log(['info'], {
        level: 'INFO',
        message: 'Redirecting to identity provider',
        requestId,
        traceId,
        decision: 'REDIRECT_TO_IDP',
        reason: 'OAuth flow initiated successfully'
      })

      // Redirect to Azure AD
      return h.redirect(authorizationUrl)
    } catch (error) {
      request.log(['error'], {
        level: 'ERROR',
        message: 'Failed to initiate OAuth flow',
        requestId,
        traceId,
        errorCode: 'OAUTH_INIT_ERROR',
        errorMessage: error.message,
        decision: 'SHOW_ERROR_PAGE',
        reason: 'Exception during OAuth initialization'
      })

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
    const requestId = request.info?.id || 'unknown'
    const traceId = request.headers?.['x-trace-id'] || requestId
    const { code, state, error } = request.query

    request.log(['debug'], {
      level: 'DEBUG',
      message: 'OAuth callback received',
      requestId,
      traceId,
      path: '/auth/callback',
      method: request.method,
      hasCode: !!code,
      hasState: !!state,
      hasError: !!error
    })

    // Handle OAuth errors from Azure AD
    if (error) {
      request.log(['warn'], {
        level: 'WARN',
        message: 'OAuth provider returned error',
        requestId,
        traceId,
        decision: 'SHOW_ERROR_PAGE',
        reason: 'Identity provider error response'
      })
      return h.view('login/index', {
        pageTitle: 'Sign in',
        errorMessage: AUTHENTICATION_MESSAGES.AZURE_AD_UNAVAILABLE,
        hasError: true
      })
    }

    // Validate required parameters
    if (!code || !state) {
      request.log(['warn'], {
        level: 'WARN',
        message: 'OAuth callback missing required parameters',
        requestId,
        traceId,
        hasCode: !!code,
        hasState: !!state,
        decision: 'SHOW_ERROR_PAGE',
        reason: 'Missing authorization code or state parameter'
      })
      return h.view('login/index', {
        pageTitle: 'Sign in',
        errorMessage: AUTHENTICATION_MESSAGES.INVALID_AUTHENTICATION_RESPONSE,
        hasError: true
      })
    }

    try {
      request.log(['debug'], {
        level: 'DEBUG',
        message: 'Validating OAuth callback parameters',
        requestId,
        traceId
      })

      // Validate state parameter for CSRF protection
      const isValidState = await validateStateParameter(state)
      if (!isValidState) {
        request.log(['warn'], {
          level: 'WARN',
          message: 'OAuth state validation failed',
          requestId,
          traceId,
          decision: 'SHOW_ERROR_PAGE',
          reason: 'Invalid or expired state parameter'
        })
        return h.view('login/index', {
          pageTitle: 'Sign in',
          errorMessage: AUTHENTICATION_MESSAGES.AUTHENTICATION_REQUEST_EXPIRED,
          hasError: true
        })
      }

      request.log(['debug'], {
        level: 'DEBUG',
        message: 'OAuth state validated successfully',
        requestId,
        traceId
      })

      // Retrieve PKCE code verifier
      const codeVerifier = await retrievePkceVerifier(state)
      if (!codeVerifier) {
        request.log(['warn'], {
          level: 'WARN',
          message: 'PKCE verifier not found',
          requestId,
          traceId,
          decision: 'SHOW_ERROR_PAGE',
          reason: 'Missing or expired PKCE verifier'
        })
        return h.view('login/index', {
          pageTitle: 'Sign in',
          errorMessage: AUTHENTICATION_MESSAGES.AUTHENTICATION_REQUEST_EXPIRED,
          hasError: true
        })
      }
      request.log(['debug'], {
        level: 'DEBUG',
        message: 'Exchanging authorization code for tokens',
        requestId,
        traceId
      })

      // Exchange authorization code for tokens
      await exchangeCodeForTokens(code, codeVerifier)

      request.log(['debug'], {
        level: 'DEBUG',
        message: 'Token exchange successful',
        requestId,
        traceId
      })

      // Create session for authenticated user
      await createSession(request, h)

      request.log(['info'], {
        level: 'INFO',
        message: 'User authentication completed',
        requestId,
        traceId,
        authMethod: 'oauth2',
        success: true,
        decision: 'REDIRECT_TO_HOME',
        reason: 'Authentication successful'
      })

      // Redirect to home page
      return h.redirect(AUTHENTICATION_ROUTES.HOME_REDIRECT_PATH)
    } catch (error) {
      request.log(['error'], {
        level: 'ERROR',
        message: 'OAuth callback processing failed',
        requestId,
        traceId,
        errorCode: 'OAUTH_CALLBACK_ERROR',
        errorMessage: error.message,
        decision: 'SHOW_ERROR_PAGE',
        reason: 'Exception during OAuth callback processing'
      })

      return h.view('login/index', {
        pageTitle: 'Sign in',
        errorMessage: AUTHENTICATION_MESSAGES.AUTHENTICATION_FAILED,
        hasError: true
      })
    }
  }
}
