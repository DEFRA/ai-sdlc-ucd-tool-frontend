import { errorController } from './controller.js'

export const error = {
  plugin: {
    name: 'error',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/error',
          ...errorController
        }
      ])
    }
  }
}
