import {
  validateAndGetAzureAdConfig,
  buildAzureAdEndpointUrl
} from './azure-ad-config.js'

/**
 * Exchanges authorization code for access and refresh tokens
 * @param {string} code - The authorization code from Azure AD
 * @param {string} codeVerifier - The PKCE code verifier
 * @returns {Promise<Object>} Token response containing access_token, refresh_token, id_token
 */
export async function exchangeCodeForTokens(code, codeVerifier) {
  const requiredFields = [
    'baseUrl',
    'clientId',
    'clientSecret',
    'redirectUri',
    'tenantId',
    'tokenEndpoint'
  ]
  const config = validateAndGetAzureAdConfig(requiredFields)

  const fullTokenUrl = buildAzureAdEndpointUrl(
    config.baseUrl,
    config.tenantId,
    config.tokenEndpoint
  )

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier
  })

  const response = await fetch(fullTokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  })

  if (!response.ok) {
    throw new Error(`Token exchange failed with status: ${response.status}`)
  }

  return await response.json()
}
