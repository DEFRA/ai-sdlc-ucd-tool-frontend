import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#errorController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('GET /error', () => {
    test('Should render error page with default message when no parameters provided', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/error'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('There was a problem')
      expect(result).toContain('try signing in again')
    })

    test('Should render error page with authentication error message', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/error?error=access_denied'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('There was a problem')
      expect(result).toContain('You do not have an account')
      expect(result).toContain('You cancelled sign in')
      expect(result).toContain('There was a technical problem')
      expect(result).toContain('try signing in again')
    })

    test('Should include retry authentication link pointing to root', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/error'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('href="/"')
      expect(result).toContain('try signing in again')
    })

    test('Should handle custom error messages passed via query parameter', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/error?message=Custom+error+message'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Custom error message')
    })

    test('Should display "What you can do" section with actionable steps', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/error'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('What you can do')
      expect(result).toContain('Check with your team')
      expect(result).toContain('Contact the AI-SDLC team')
    })

    test('Should render fallback plain text error if template fails', async () => {
      // This test simulates a template rendering failure
      // We'll mock the view handler to throw an error
      const mockRequest = {
        method: 'GET',
        url: '/error?template_error=true'
      }

      const { result, statusCode } = await server.inject(mockRequest)

      // When template fails, we expect a plain text fallback
      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('An error occurred. Please try again.')
    })
  })
})
