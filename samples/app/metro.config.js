/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-var-requires */
// eslint-disable-next-line import/no-extraneous-dependencies
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('path')
const escape = require('escape-string-regexp')

const exclusionList = (additionalExclusions = []) => {
  const defaults = [/\/__tests__\/.*/]

  const escapeRegExp = (pattern) => {
    if (pattern instanceof RegExp) {
      return pattern.source.replace(/\/|\\\//g, `\\${path.sep}`)
    }
    if (typeof pattern === 'string') {
      const escaped = pattern.replace(/[\-\[\]\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')
      return escaped.replaceAll('/', `\\${path.sep}`)
    }
    throw new Error(`Expected exclusionList to be called with RegExp or string, got: ${typeof pattern}`)
  }

  return new RegExp(`(${additionalExclusions.concat(defaults).map(escapeRegExp).join('|')})$`)
}

const packageDirs = [
  path.resolve(__dirname, '../../packages/core'),
  path.resolve(__dirname, '../../packages/oca'),
  path.resolve(__dirname, '../../packages/openid4vp'),
  path.resolve(__dirname, '../../packages/react-hooks'),
  path.resolve(__dirname, '../../packages/trust-registry'),
  path.resolve(__dirname, '../../packages/ui'),
  path.resolve(__dirname, '../../packages/verifier'),
  path.resolve(__dirname, '../../packages/backup'),
]

const dependencyDirs = [
  path.resolve(__dirname, '../../node_modules/@openid4vc/oauth2'),
  path.resolve(__dirname, '../../node_modules/@openid4vc/openid4vp'),
  path.resolve(__dirname, '../../node_modules/@openid4vc/utils'),
  path.resolve(__dirname, '../../node_modules/jose'),
]

const watchFolders = [...packageDirs, ...dependencyDirs]

const extraExclusionList = []
const extraNodeModules = {
  '@bifold/backup': path.resolve(__dirname, '../../packages/backup'),
  '@bifold/openid4vp': path.resolve(__dirname, '../../packages/openid4vp'),
  '@bifold/trust-registry': path.resolve(__dirname, '../../packages/trust-registry'),
  '@bifold/ui': path.resolve(__dirname, '../../packages/ui'),
}
const localPackageEntryPoints = {
  '@bifold/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
  '@bifold/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
}
const exactPackageEntryPoints = {
  '@openid4vc/oauth2': path.resolve(__dirname, '../../node_modules/@openid4vc/oauth2/dist/index.mjs'),
  '@openid4vc/openid4vp': path.resolve(__dirname, '../../node_modules/@openid4vc/openid4vp/dist/index.mjs'),
  '@openid4vc/utils': path.resolve(__dirname, '../../node_modules/@openid4vc/utils/dist/index.mjs'),
  jose: path.resolve(__dirname, '../../node_modules/jose/dist/browser/index.js'),
}

const fallbackResolveRequest = (context, moduleName, platform) => {
  if (context.resolveRequest) {
    return context.resolveRequest(context, moduleName, platform)
  }

  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const { resolve } = require('metro-resolver')
  return resolve(context, moduleName, platform)
}

for (const packageDir of packageDirs) {
  const pak = require(path.join(packageDir, 'package.json'))
  const modules = Object.keys({
    ...pak.dependencies,
    ...pak.peerDependencies,
    ...pak.devDependencies,
  })
  extraExclusionList.push(...modules.map((m) => path.join(packageDir, 'node_modules', m)))

  modules.reduce((acc, name) => {
    if (!(name in acc)) {
      acc[name] = path.join(__dirname, 'node_modules', name)
    }
    return acc
  }, extraNodeModules)
}

const defaultConfig = getDefaultConfig(__dirname)
const {
  resolver: { sourceExts, assetExts },
} = defaultConfig

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const combinedWatchFolders = Array.from(new Set([...(defaultConfig.watchFolders || []), ...watchFolders]))

const config = mergeConfig(defaultConfig, {
  transformer: {
    ...defaultConfig.transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    ...defaultConfig.resolver,
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName in localPackageEntryPoints) {
        return {
          type: 'sourceFile',
          filePath: localPackageEntryPoints[moduleName],
        }
      }

      if (moduleName in exactPackageEntryPoints) {
        return {
          type: 'sourceFile',
          filePath: exactPackageEntryPoints[moduleName],
        }
      }

      return fallbackResolveRequest(context, moduleName, platform)
    },
    blockList: exclusionList(extraExclusionList.map((m) => new RegExp(`^${escape(m)}[/\\\\].*$`))),
    extraNodeModules: {
      ...(defaultConfig.resolver.extraNodeModules || {}),
      ...extraNodeModules,
    },
    tslib: path.join(__dirname, 'node_modules/tslib'),
    assetExts: assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...sourceExts, 'svg', 'cjs', 'mjs'],
    unstable_enablePackageExports: true,
    unstable_conditionNames: ['react-native', 'browser', 'require'],
  },
  watchFolders: combinedWatchFolders,
})

module.exports = config
