/**
 * Authentication-related constants
 * Following intention-revealing naming principles from workspace rules
 */

export const AUTHENTICATION_MESSAGES = {
  INVALID_PASSWORD: 'Invalid password',
  SUCCESS_MESSAGE: 'Authentication successful',
  SERVICE_UNAVAILABLE:
    'Service temporarily unavailable. Please try again in a few moments.',
  AZURE_AD_UNAVAILABLE:
    'Authentication service is temporarily unavailable. Please try again later.',
  AUTHENTICATION_FAILED: 'Authentication failed. Please try again.',
  INVALID_AUTHENTICATION_RESPONSE:
    'Invalid authentication response. Please try again.',
  AUTHENTICATION_REQUEST_EXPIRED:
    'Authentication request expired. Please try again.'
}

export const AUTHENTICATION_ROUTES = {
  HOME_REDIRECT_PATH: '/',
  LOGIN_PATH: '/login',
  AUTH_CALLBACK_PATH: '/auth/callback'
}

export const HTTP_HEADER_NAMES = {
  LOCATION: 'location'
}

export const OAUTH_CONSTANTS = {
  RESPONSE_TYPE: 'code',
  RESPONSE_MODE: 'query',
  SCOPE: 'openid profile email',
  CODE_CHALLENGE_METHOD: 'S256',
  STATE_TTL_SECONDS: 300, // 5 minutes
  STATE_KEY_PREFIX: 'auth:state:',
  PKCE_KEY_PREFIX: 'auth:pkce:'
}
