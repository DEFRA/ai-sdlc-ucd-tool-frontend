/**
 * Error page constants
 * Following intention-revealing naming principles from workspace rules
 */

export const ERROR_MESSAGES = {
  DEFAULT_ERROR: 'There was a problem signing you in',
  FALLBACK_ERROR: 'An error occurred. Please try again.',
  PAGE_TITLE: 'There was a problem',
  POSSIBLE_REASONS_TITLE: 'This might be because:',
  WHAT_YOU_CAN_DO_TITLE: 'What you can do',
  RETRY_LINK_TEXT: 'try signing in again'
}

export const ERROR_REASONS = {
  NO_ACCOUNT: 'You do not have an account',
  CANCELLED_SIGNIN: 'You cancelled sign in',
  TECHNICAL_PROBLEM: 'There was a technical problem'
}

export const ERROR_ACTIONS = {
  CHECK_ACCESS: 'Check with your team that you should have access',
  CONTACT_TEAM: 'Contact the AI-SDLC team if you continue to have problems'
}

export const ERROR_ROUTES = {
  RETRY_PATH: '/'
}
