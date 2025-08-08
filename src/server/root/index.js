import { rootController } from './controller.js'

/**
 * Sets up the root route with session validation
 */
export const root = {
  plugin: {
    name: 'root',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/',
          ...rootController
        }
      ])
    }
  }
}
