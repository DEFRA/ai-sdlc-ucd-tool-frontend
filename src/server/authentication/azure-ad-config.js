import { config } from '../../config/config.js'

/**
 * Validates Azure AD configuration and returns the required configuration values
 * @param {string[]} requiredFields - Array of required configuration field names
 * @returns {Object} Configuration values keyed by field name
 * @throws {Error} If any required configuration is missing
 */
export function validateAndGetAzureAdConfig(requiredFields) {
  const configValues = {}
  const missingFields = []

  for (const field of requiredFields) {
    const value = config.get(`azureAd.${field}`)
    if (!value) {
      missingFields.push(field)
    } else {
      configValues[field] = value
    }
  }

  if (missingFields.length > 0) {
    throw new Error(
      `Azure AD configuration is incomplete. Missing: ${missingFields.join(', ')}`
    )
  }

  return configValues
}

/**
 * Builds a full Azure AD endpoint URL
 * @param {string} baseUrl - The Azure AD base URL
 * @param {string} tenantId - The tenant ID
 * @param {string} endpoint - The specific endpoint path
 * @returns {string} The complete endpoint URL
 */
export function buildAzureAdEndpointUrl(baseUrl, tenantId, endpoint) {
  return `${baseUrl}/${tenantId}/${endpoint}`
}
