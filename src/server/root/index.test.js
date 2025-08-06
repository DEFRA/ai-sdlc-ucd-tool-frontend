import { describe, it, expect, vi } from 'vitest'
import { root } from './index.js'
import { rootController } from './controller.js'

describe('root plugin', () => {
  it('should have the correct plugin name', () => {
    expect(root.plugin.name).toBe('root')
  })

  it('should register root route with correct configuration', () => {
    const mockServer = {
      route: vi.fn()
    }

    root.plugin.register(mockServer)

    expect(mockServer.route).toHaveBeenCalledWith([
      {
        method: 'GET',
        path: '/',
        ...rootController
      }
    ])
  })
})
