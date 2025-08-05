import { OAUTH_CONSTANTS } from '../common/constants/authentication-constants.js'
import {
  validateAndGetAzureAdConfig,
  buildAzureAdEndpointUrl
} from './azure-ad-config.js'

/**
 * Builds the Azure AD authorization URL
 * @param {string} state - The state parameter for CSRF protection
 * @param {string} codeChallenge - The PKCE code challenge
 * @returns {string} The complete authorization URL
 */
export function buildAuthorizationUrl(state, codeChallenge) {
  const requiredFields = [
    'baseUrl',
    'clientId',
    'redirectUri',
    'tenantId',
    'authorizeEndpoint'
  ]
  const config = validateAndGetAzureAdConfig(requiredFields)

  const fullAuthorizeUrl = buildAzureAdEndpointUrl(
    config.baseUrl,
    config.tenantId,
    config.authorizeEndpoint
  )

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: OAUTH_CONSTANTS.RESPONSE_TYPE,
    redirect_uri: config.redirectUri,
    response_mode: OAUTH_CONSTANTS.RESPONSE_MODE,
    scope: OAUTH_CONSTANTS.SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: OAUTH_CONSTANTS.CODE_CHALLENGE_METHOD
  })

  return `${fullAuthorizeUrl}?${params.toString()}`
}
