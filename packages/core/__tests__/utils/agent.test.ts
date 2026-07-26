jest.mock('@credo-ts/react-native', () => ({
  SecureEnvironmentKeyManagementService: jest.fn().mockImplementation(() => ({})),
}))

import { getAgentModules } from '../../src/utils/agent'

describe('getAgentModules', () => {
  it('registers a did:sov resolver', () => {
    const modules = getAgentModules({
      walletSecret: {
        id: 'test-wallet',
        key: 'test-key',
        salt: 'test-salt',
      },
      indyNetworks: [],
    })

    const supportedMethods = modules.dids.config.resolvers.flatMap((resolver) => resolver.supportedMethods)

    expect(supportedMethods).toContain('sov')
  })
})
