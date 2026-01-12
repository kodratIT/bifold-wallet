import { BifoldLogger, Container, TokenMapping, TOKENS } from '@bifold/core'
import { TrustRegistryService, TrustBadgeWrapper, TrustRegistryModal, TrustConfirmModal, useFederatedTrust, useVerifierTrust } from '@bifold/trust-registry'
import { DependencyContainer } from 'tsyringe'
import { getTrustRegistryConfig, isTrustRegistryConfigured } from './config/trustRegistry'

export class AppContainer implements Container {
  private _container: DependencyContainer
  private log?: BifoldLogger

  public constructor(bifoldContainer: Container, log?: BifoldLogger) {
    this._container = bifoldContainer.container.createChildContainer()
    this.log = log
  }

  public get container(): DependencyContainer {
    return this._container
  }

  public init(): Container {
    // eslint-disable-next-line no-console
    this.log?.info(`Initializing App container`)
    // Here you can register any component to override components in core package
    // Example: Replacing button in core with custom button
    // this.container.registerInstance(TOKENS.COMP_BUTTON, Button)

    // Trust Registry Configuration from environment variables
    this.initTrustRegistry()

    //This is an example of how to customize the screen layout and use custom header for wallets who wnat to hide default navigation header
    //To hide navigation header for a specific page, use headerShown: false in the screen options like this
    /**
    this.container.registerInstance(TOKENS.OBJECT_SCREEN_CONFIG, {
      ...DefaultScreenOptionsDictionary,
      [Screens.Terms]: {
        ...DefaultScreenOptionsDictionary[Screens.Terms],
        headerShown: false,
      },
    })

    //Customizing Terms screen custom header
    this.container.registerInstance(TOKENS.OBJECT_LAYOUT_CONFIG, {
      ...DefaultScreenLayoutOptions,
      [Screens.Terms]: {
        ...DefaultScreenLayoutOptions[Screens.Terms],
        customEdges: ['bottom'],
        safeArea: true,
        Header: () => (
          <View style={{ backgroundColor: 'red', height: 129, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: 'white' }}>Custom Header</Text>
          </View>
        ),
      },
    })
    // Add custom pbkdf hashing algorithm implementation using react-native-quick-crypto
    this.container.registerInstance(TOKENS.FN_PIN_HASH_ALGORITHM, (PIN: string, salt: string) => {
      try {
        const hashedPIN = crypto.pbkdf2Sync(PIN, salt, 300000, 128, 'sha256').toString('hex')
        return hashedPIN
      } catch (error) {
        throw new Error(`Error generating hash for PIN ${String((error as Error)?.message ?? error)}`)
      }
    })
    */

    return this
  }

  public resolve<K extends keyof TokenMapping>(token: K): TokenMapping[K] {
    return this._container.resolve(token)
  }
  public resolveAll<K extends keyof TokenMapping, T extends K[]>(
    tokens: [...T]
  ): { [I in keyof T]: TokenMapping[T[I]] } {
    return tokens.map((key) => this.resolve(key)!) as { [I in keyof T]: TokenMapping[T[I]] }
  }

  /**
   * Initialize Trust Registry from environment variables
   */
  private initTrustRegistry(): void {
    const config = getTrustRegistryConfig()

    // Override default config with env values
    this._container.registerInstance(TOKENS.TRUST_REGISTRY_CONFIG, config)

    // Register service if properly configured
    if (isTrustRegistryConfigured()) {
      this.log?.info('Trust Registry enabled', {
        url: config.url,
        ecosystemDid: config.ecosystemDid,
      })

      const service = new TrustRegistryService(config, this.log)
      this._container.registerInstance(TOKENS.TRUST_REGISTRY_SERVICE, service)
    } else if (config.enabled) {
      this.log?.warn('Trust Registry enabled but not properly configured - missing url or ecosystemDid')
    }

    // Register UI components
    this._container.registerInstance(TOKENS.COMPONENT_TRUST_BADGE, TrustBadgeWrapper)
    this._container.registerInstance(TOKENS.COMPONENT_TRUST_REGISTRY_MODAL, TrustRegistryModal)
    this._container.registerInstance(TOKENS.COMPONENT_TRUST_CONFIRM_MODAL, TrustConfirmModal)
    this._container.registerInstance(TOKENS.HOOK_USE_FEDERATED_TRUST, useFederatedTrust)
    this._container.registerInstance(TOKENS.HOOK_USE_VERIFIER_TRUST, useVerifierTrust)
  }
}
