import { uploadDocumentController } from './controller.js'

/**
 * Sets up the upload document routes
 */
export const uploadDocument = {
  plugin: {
    name: 'upload-document',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/upload-document',
          ...uploadDocumentController
        }
      ])
    }
  }
}
