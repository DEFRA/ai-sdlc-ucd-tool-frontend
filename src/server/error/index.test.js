import { error } from './index.js'

describe('#error route plugin', () => {
  test('Should export a plugin with name and register method', () => {
    expect(error).toBeDefined()
    expect(error.plugin).toBeDefined()
    expect(error.plugin.name).toBe('error')
    expect(typeof error.plugin.register).toBe('function')
  })

  test('Should register error route when plugin is loaded', () => {
    const mockServer = {
      route: vi.fn()
    }

    error.plugin.register(mockServer)

    expect(mockServer.route).toHaveBeenCalledTimes(1)
    expect(mockServer.route).toHaveBeenCalledWith([
      expect.objectContaining({
        method: 'GET',
        path: '/error'
      })
    ])
  })
})
