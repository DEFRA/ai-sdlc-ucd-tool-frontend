import convict from 'convict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import convictFormatWithValidator from 'convict-format-with-validator'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const fourHoursMs = 14400000
const oneWeekMs = 604800000

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const isDevelopment = process.env.NODE_ENV === 'development'

convict.addFormats(convictFormatWithValidator)

export const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3000,
    env: 'PORT'
  },
  staticCacheTimeout: {
    doc: 'Static cache timeout in milliseconds',
    format: Number,
    default: oneWeekMs,
    env: 'STATIC_CACHE_TIMEOUT'
  },
  serviceName: {
    doc: 'Applications Service Name',
    format: String,
    default: 'ai-sdlc-ucd-tool-frontend'
  },
  root: {
    doc: 'Project root',
    format: String,
    default: path.resolve(dirname, '../..')
  },
  assetPath: {
    doc: 'Asset path',
    format: String,
    default: '/public',
    env: 'ASSET_PATH'
  },
  isProduction: {
    doc: 'If this application running in the production environment',
    format: Boolean,
    default: isProduction
  },
  isDevelopment: {
    doc: 'If this application running in the development environment',
    format: Boolean,
    default: isDevelopment
  },
  isTest: {
    doc: 'If this application running in the test environment',
    format: Boolean,
    default: isTest
  },
  log: {
    enabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: process.env.NODE_ENV !== 'test',
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in.',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : []
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  isSecureContextEnabled: {
    doc: 'Enable Secure Context',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_SECURE_CONTEXT'
  },
  isMetricsEnabled: {
    doc: 'Enable metrics reporting',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_METRICS'
  },
  session: {
    cache: {
      engine: {
        doc: 'backend cache is written to',
        format: ['redis', 'memory'],
        default: isProduction ? 'redis' : 'memory',
        env: 'SESSION_CACHE_ENGINE'
      },
      name: {
        doc: 'server side session cache name',
        format: String,
        default: 'session',
        env: 'SESSION_CACHE_NAME'
      },
      ttl: {
        doc: 'server side session cache ttl',
        format: Number,
        default: fourHoursMs,
        env: 'SESSION_CACHE_TTL'
      }
    },
    cookie: {
      ttl: {
        doc: 'Session cookie ttl',
        format: Number,
        default: fourHoursMs,
        env: 'SESSION_COOKIE_TTL'
      },
      password: {
        doc: 'session cookie password',
        format: String,
        default: 'the-password-must-be-at-least-32-characters-long',
        env: 'SESSION_COOKIE_PASSWORD',
        sensitive: true
      },
      secure: {
        doc: 'set secure flag on cookie',
        format: Boolean,
        default: isProduction,
        env: 'SESSION_COOKIE_SECURE'
      }
    }
  },
  redis: {
    host: {
      doc: 'Redis cache host',
      format: String,
      default: '127.0.0.1',
      env: 'REDIS_HOST'
    },
    port: {
      doc: 'Redis cache port',
      format: 'port',
      default: 6379,
      env: 'REDIS_PORT'
    },
    username: {
      doc: 'Redis cache username',
      format: String,
      default: '',
      env: 'REDIS_USERNAME'
    },
    password: {
      doc: 'Redis cache password',
      format: '*',
      default: '',
      sensitive: true,
      env: 'REDIS_PASSWORD'
    },
    keyPrefix: {
      doc: 'Redis cache key prefix name used to isolate the cached results across multiple clients',
      format: String,
      default: 'ai-sdlc-ucd-tool-frontend:',
      env: 'REDIS_KEY_PREFIX'
    },
    useSingleInstanceCache: {
      doc: 'Connect to a single instance of redis instead of a cluster.',
      format: Boolean,
      default: !isProduction,
      env: 'USE_SINGLE_INSTANCE_CACHE'
    },
    useTLS: {
      doc: 'Connect to redis using TLS',
      format: Boolean,
      default: isProduction,
      env: 'REDIS_TLS'
    }
  },
  azureAd: {
    clientId: {
      doc: 'Azure AD OAuth Client ID',
      format: String,
      default: isDevelopment ? 'dev-client-id' : '',
      env: 'AZURE_AD_CLIENT_ID'
    },
    clientSecret: {
      doc: 'Azure AD OAuth Client Secret',
      format: String,
      default: isDevelopment ? 'dev-client-secret' : '',
      env: 'AZURE_AD_CLIENT_SECRET',
      sensitive: true
    },
    tenantId: {
      doc: 'Azure AD Tenant ID',
      format: String,
      default: isDevelopment ? 'common' : '',
      env: 'AZURE_AD_TENANT_ID'
    },
    redirectUri: {
      doc: 'Azure AD OAuth Redirect URI',
      format: String,
      default: isDevelopment ? 'http://localhost:3000/auth/callback' : '',
      env: 'AZURE_AD_REDIRECT_URI'
    }
  },
  nunjucks: {
    watch: {
      doc: 'Reload templates when they are changed.',
      format: Boolean,
      default: isDevelopment
    },
    noCache: {
      doc: 'Use a cache and recompile templates each time',
      format: Boolean,
      default: isDevelopment
    }
  },
  tracing: {
    header: {
      doc: 'Which header to track',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  }
})

// Story 1.1 - Core Configuration Module Helper Functions

/**
 * Extract Azure AD OAuth settings from environment variables
 * @returns {Object} Azure AD configuration object
 */
export function getAzureAdConfig() {
  const currentEnv = process.env.NODE_ENV
  const isDev = currentEnv === 'development'

  return {
    clientId: process.env.AZURE_AD_CLIENT_ID || (isDev ? 'dev-client-id' : ''),
    clientSecret:
      process.env.AZURE_AD_CLIENT_SECRET || (isDev ? 'dev-client-secret' : ''),
    tenantId: process.env.AZURE_AD_TENANT_ID || (isDev ? 'common' : ''),
    redirectUri:
      process.env.AZURE_AD_REDIRECT_URI ||
      (isDev ? 'http://localhost:3000/auth/callback' : '')
  }
}

/**
 * Validate Azure AD configuration
 * @throws {Error} When configuration is invalid
 */
export function validateAzureAdConfig() {
  const azureConfig = getAzureAdConfig()
  const currentEnv = process.env.NODE_ENV
  const isProd = currentEnv === 'production'

  if (isProd) {
    const missingFields = []
    if (!azureConfig.clientId) missingFields.push('AZURE_AD_CLIENT_ID')
    if (!azureConfig.clientSecret) missingFields.push('AZURE_AD_CLIENT_SECRET')
    if (!azureConfig.tenantId) missingFields.push('AZURE_AD_TENANT_ID')
    if (!azureConfig.redirectUri) missingFields.push('AZURE_AD_REDIRECT_URI')

    if (missingFields.length > 0) {
      throw new Error('Missing required Azure AD configuration')
    }
  }

  if (azureConfig.clientId === '') {
    throw new Error('Azure AD Client ID cannot be empty')
  }
}

/**
 * Extract Redis connection details from environment variables
 * @returns {Object} Redis configuration object
 */
export function getRedisConfig() {
  const currentEnv = process.env.NODE_ENV
  const isDev = currentEnv === 'development'

  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    username: process.env.REDIS_USERNAME || '',
    password: process.env.REDIS_PASSWORD || '',
    useTLS:
      process.env.REDIS_TLS === 'true' ||
      (!isDev && currentEnv === 'production')
  }
}

/**
 * Validate Redis configuration
 * @throws {Error} When configuration is invalid
 */
export function validateRedisConfig() {
  const redisConfig = getRedisConfig()
  const currentEnv = process.env.NODE_ENV
  const isProd = currentEnv === 'production'

  if (isProd && !redisConfig.password) {
    throw new Error('Redis password is required in production')
  }

  if (process.env.REDIS_PORT && isNaN(Number(process.env.REDIS_PORT))) {
    throw new Error('Redis port must be a valid number')
  }
}

/**
 * Get Redis production defaults
 * @returns {Object} Redis production configuration
 */
export function getRedisProductionDefaults() {
  return {
    useTLS: true
  }
}

/**
 * Extract session management configuration
 * @returns {Object} Session configuration object
 */
export function getSessionConfig() {
  const currentEnv = process.env.NODE_ENV
  const isProd = currentEnv === 'production'
  const sessionTtl = process.env.SESSION_TTL
    ? Number(process.env.SESSION_TTL)
    : fourHoursMs

  return {
    ttl: sessionTtl,
    cookie: {
      secure: process.env.SESSION_COOKIE_SECURE === 'true' || isProd,
      httpOnly: process.env.SESSION_COOKIE_HTTP_ONLY === 'true' || true,
      sameSite: isProd ? 'strict' : 'lax'
    },
    cache: {
      engine: process.env.SESSION_CACHE_ENGINE || (isProd ? 'redis' : 'memory')
    }
  }
}

/**
 * Validate session configuration
 * @throws {Error} When configuration is invalid
 */
export function validateSessionConfig() {
  const sessionTtl = process.env.SESSION_TTL
    ? Number(process.env.SESSION_TTL)
    : fourHoursMs

  if (sessionTtl <= 0) {
    throw new Error('Session TTL must be positive')
  }
}

/**
 * Load environment-specific configuration
 * @returns {Object} Environment configuration object
 */
export function loadEnvironmentConfig() {
  const currentEnv = process.env.NODE_ENV

  if (currentEnv === 'production') {
    return {
      strict: true,
      defaults: { secure: true },
      requiresValidation: true
    }
  }

  if (currentEnv === 'development') {
    return {
      strict: false,
      allowMissingSecrets: true,
      defaults: { secure: false }
    }
  }

  if (currentEnv === 'test') {
    return {
      cache: { engine: 'memory' },
      externalDependencies: { enabled: false },
      logging: { enabled: false }
    }
  }

  return {}
}

/**
 * Validate startup configuration
 * @returns {Object} Validation result
 * @throws {Error} When configuration is invalid
 */
export function validateStartupConfiguration() {
  const currentEnv = process.env.NODE_ENV
  const isProd = currentEnv === 'production'

  // Check for missing Azure AD settings in production
  if (isProd) {
    const azureConfig = getAzureAdConfig()
    const missingFields = []
    if (!azureConfig.clientId) missingFields.push('AZURE_AD_CLIENT_ID')
    if (!azureConfig.clientSecret) missingFields.push('AZURE_AD_CLIENT_SECRET')

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required Azure AD settings: ${missingFields.join(', ')}`
      )
    }
  }

  // Check for type validation errors
  if (process.env.SESSION_TTL && isNaN(Number(process.env.SESSION_TTL))) {
    throw new Error(
      'Type validation failed: SESSION_TTL expected number, got string'
    )
  }

  return {
    valid: true,
    config: config.getProperties(),
    errors: []
  }
}

config.validate({ allowed: 'strict' })
