import {
  showLoginFormController,
  authCallbackController
} from './controller.js'

/**
 * Sets up the routes used for login functionality.
 * These routes are registered in src/server/router.js.
 */
export const login = {
  plugin: {
    name: 'login',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/login',
          ...showLoginFormController
        },
        {
          method: 'GET',
          path: '/auth/callback',
          ...authCallbackController
        }
      ])
    }
  }
}
