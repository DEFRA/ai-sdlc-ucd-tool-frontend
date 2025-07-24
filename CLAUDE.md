# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js/HAPI frontend application for the AI SDLC UCD Toolkit, implementing authentication and session management. The project follows GDS (Government Digital Service) standards and uses the CDP (Core Delivery Platform) template.

## Common Development Commands

### Development

```bash
npm run dev           # Run development server with hot reload
npm run dev:debug     # Run with debugging enabled
npm start             # Run production server
```

### Testing

```bash
npm test              # Run all tests with coverage
npm run test:watch    # Run tests in watch mode
vitest run            # Alternative test command
vitest <filename>     # Run specific test file
```

### Code Quality

```bash
npm run lint          # Run ESLint and Stylelint
npm run lint:js:fix   # Auto-fix JavaScript linting issues
npm run format        # Format code with Prettier
npm run format:check  # Check formatting without fixing
```

### Build

```bash
npm run build:frontend  # Build frontend assets with Webpack
```

## Architecture

### High-Level Structure

The application implements a BFF (Backend for Frontend) pattern with:

- **Frontend Service (this repo)**: Node.js/HAPI handling authentication, sessions, and UI
- **Backend Service**: Python service for business logic (separate repo)
- **Redis**: Session storage
- **Authentication**: Password-based with JWT tokens for API access

### Key Directories

```
src/
├── server/              # Server-side code
│   ├── common/          # Shared components
│   │   ├── templates/   # Base templates (page.njk)
│   │   ├── components/  # Reusable UI components
│   │   └── helpers/     # Utilities (logging, redis, etc)
│   ├── {feature}/       # Feature modules (home, login, etc)
│   │   ├── controller.js    # Request handlers
│   │   ├── controller.test.js
│   │   ├── index.js        # Route definitions
│   │   └── views/         # Feature templates
│   └── router.js        # Route aggregation
├── client/              # Client-side JavaScript
└── config/              # Configuration
    ├── config.js        # Convict configuration
    └── nunjucks/        # Template engine setup
```

### Authentication Flow

1. User submits password → Frontend validates against `SHARED_PASSWORD` env var
2. Frontend creates session in Redis with JWT token
3. Frontend sets HTTP-only session cookie
4. API requests include Bearer token from session
5. Backend validates JWT with shared secret

### Session Management

- Sessions stored in Redis with configurable TTL (default 4 hours)
- Session data structure includes: session_id, session_token, created_at, expires_at
- Automatic session extension on activity
- Cookie-based session tracking

## Code Patterns

### Controller Pattern

```javascript
export const myController = {
  handler(request, h) {
    // Business logic
    return h.view('template/path', {
      pageTitle: 'Title',
      data: processedData
    })
  }
}
```

### Route Definition

```javascript
export const myFeature = {
  plugin: {
    name: 'myFeature',
    async register(server) {
      server.route([
        {
          method: 'GET',
          path: '/my-path',
          ...myController
        }
      ])
    }
  }
}
```

### Testing Pattern

```javascript
describe('Controller', () => {
  let server

  beforeEach(async () => {
    server = await createServer()
  })

  test('should handle request', async () => {
    const { payload, statusCode } = await server.inject({
      method: 'GET',
      url: '/path'
    })

    expect(statusCode).toBe(200)
    expect(payload).toContain('expected content')
  })
})
```

## Configuration

The application uses Convict for configuration management. Key settings:

- `SHARED_PASSWORD`: Authentication password
- `SESSION_COOKIE_PASSWORD`: Cookie encryption (32+ chars)
- `REDIS_HOST`: Redis connection
- `NODE_ENV`: Environment (development/test/production)
- `LOG_LEVEL`: Logging verbosity

See `src/config/config.js` for all options.

## Template System

Uses Nunjucks with GDS components:

- Base template: `layouts/page.njk`
- Feature templates in feature directories
- Search paths configured for govuk-frontend
- Custom filters in `src/config/nunjucks/filters/`

## Test-Driven Development

The project includes a custom `/red` slash command for TDD workflow:

- Reads requirements from vault documents
- Creates feature branches
- Implements RED phase of TDD
- Located in `.claude/slash_commands/red.md`

## Important Notes

- Follow GDS design patterns and components
- Use HAPI framework (not Express)
- Maintain separation between frontend BFF and backend API
- Session management critical for authentication
- Redis required for production deployments
