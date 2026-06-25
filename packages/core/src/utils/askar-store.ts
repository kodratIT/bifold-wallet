import { AskarModuleConfig, AskarModuleConfigStoreOptions } from '@credo-ts/askar'
import { Agent } from '@credo-ts/core'

export interface WalletConfig {
  id: string
  key: string
}

export interface WalletExportOptions {
  path: string
  key: string
}

const getAskarConfig = (agent: Agent<any>): AskarModuleConfig => {
  return agent.dependencyManager.resolve(AskarModuleConfig)
}

const updateStoreConfig = (agent: Agent<any>, walletConfig: WalletConfig) => {
  const askarConfig = getAskarConfig(agent)
  askarConfig.store.id = walletConfig.id
  askarConfig.store.key = walletConfig.key
}

const storeConfigForFile = (id: string, key: string, path: string): AskarModuleConfigStoreOptions => ({
  id,
  key,
  database: {
    type: 'sqlite',
    config: { path },
  },
})

export const getWalletConfig = (agent: Agent<any>): WalletConfig => {
  const { id, key } = getAskarConfig(agent).store
  return { id, key }
}

export const isWalletOpen = (agent: Agent<any>): boolean => {
  return agent.modules.askar.isStoreOpen
}

export const closeWalletIfOpen = async (agent: Agent<any>) => {
  if (isWalletOpen(agent)) {
    await agent.modules.askar.closeStore()
  }
}

export const createWallet = async (agent: Agent<any>, walletConfig: WalletConfig) => {
  updateStoreConfig(agent, walletConfig)
  await agent.modules.askar.provisionStore()
}

export const openWallet = async (agent: Agent<any>, walletConfig: WalletConfig) => {
  updateStoreConfig(agent, walletConfig)
  await agent.modules.askar.openStore()
}

export const deleteWalletStore = async (agent: Agent<any>, walletConfig?: WalletConfig) => {
  if (walletConfig) {
    updateStoreConfig(agent, walletConfig)
  }
  await agent.modules.askar.deleteStore()
}

export const exportWallet = async (agent: Agent<any>, options: WalletExportOptions) => {
  const currentConfig = getWalletConfig(agent)
  await agent.modules.askar.exportStore({
    exportToStore: storeConfigForFile(`${currentConfig.id}-export`, options.key, options.path),
  })
}

export const importWallet = async (
  agent: Agent<any>,
  walletConfig: WalletConfig,
  options: WalletExportOptions
) => {
  updateStoreConfig(agent, walletConfig)
  await agent.modules.askar.importStore({
    importFromStore: storeConfigForFile(`${walletConfig.id}-import`, options.key, options.path),
  })
}
