import {
  attestKeyAsync,
  generateHardwareAttestedKeyAsync,
  generateKeyAsync,
  getAttestationCertificateChainAsync,
  isSupported as isDeviceAttestationSupported,
} from '@expo/app-integrity'
import React, { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Animated, DeviceEventEmitter, Easing, Platform, StatusBar as RNStatusBar, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import uuid from 'react-native-uuid'

import {
  BifoldError,
  DispatchAction,
  EventTypes,
  LocalStorageKeys,
  PersistentStorage,
  TOKENS,
  useAuth,
  useServices,
  useStore,
  WalletSecret,
} from '@bifold/core'

import { onboardingColors } from '../theme/onboarding'

export type SplashProps = {
  initializeAgent: (walletSecret: WalletSecret) => Promise<void>
}

const retryAsync = async <T,>(fn: (...args: any[]) => Promise<T>, args: any[], retries = 3): Promise<T> => {
  try {
    return await fn(...args)
  } catch (error) {
    if (retries <= 1) {
      throw error
    }

    return retryAsync(fn, args, retries - 1)
  }
}

const useSplashAttestation = () => {
  const [getAttestationChallenge, getAttestationJWT, { enableAttestation }, logger, agentBridge] = useServices([
    TOKENS.FN_ATTESTATION_GET_CHALLENGE,
    TOKENS.FN_ATTESTATION_GET_JWT,
    TOKENS.CONFIG,
    TOKENS.UTIL_LOGGER,
    TOKENS.UTIL_AGENT_BRIDGE,
  ])
  const [, dispatch] = useStore()

  const storeAttestationJWT = useCallback(
    async (attestationJWT: any, keyID: string) => {
      try {
        ;(agentBridge as any).onReady(async (agent: any) => {
          await agent.genericRecords.save({
            content: attestationJWT,
            id: 'attestationJWT',
          })
          await PersistentStorage.storeValueForKey(LocalStorageKeys.AttestationConfigured, true)
          await PersistentStorage.storeValueForKey(LocalStorageKeys.AttestationKey, keyID)
          dispatch({ type: DispatchAction.SET_ATTESTATION_COMPLETED, payload: [true] })
        })
      } catch (err: any) {
        logger.error(err?.message ?? 'Error initializing attestation')
        throw new Error('Error storing attestation result')
      }
    },
    [agentBridge, dispatch, logger]
  )

  const setupAttestation = useCallback(async (): Promise<void> => {
    try {
      if (!enableAttestation) {
        dispatch({ type: DispatchAction.SET_ATTESTATION_COMPLETED, payload: [true] })
        return
      }

      const isAttestationConfigured = await PersistentStorage.fetchValueForKey(LocalStorageKeys.AttestationConfigured)
      if (isAttestationConfigured) {
        dispatch({ type: DispatchAction.SET_ATTESTATION_COMPLETED, payload: [true] })
        return
      }

      const challenge = await (getAttestationChallenge as () => Promise<string>)()

      if (Platform.OS === 'ios') {
        if (!isDeviceAttestationSupported) {
          throw new Error('iOS device not supported')
        }

        const keyID = await generateKeyAsync()
        const attestationResult = await retryAsync(attestKeyAsync, [keyID, challenge])
        const attestationJWT = await (getAttestationJWT as any)(attestationResult, challenge, keyID)
        await storeAttestationJWT(attestationJWT, keyID)
      } else if (Platform.OS === 'android') {
        const keyID = uuid.v4().toString()
        await generateHardwareAttestedKeyAsync(keyID, challenge)
        const attestationResult = await retryAsync(getAttestationCertificateChainAsync, [keyID])
        const attestationJWT = await (getAttestationJWT as any)(attestationResult, challenge, keyID)
        await storeAttestationJWT(attestationJWT, keyID)
      } else {
        throw new Error('Platform not supported')
      }
    } catch (err: any) {
      logger.error(err?.message ?? 'Error initializing attestation')
      throw new Error('Error initializing attestation')
    }
  }, [enableAttestation, getAttestationChallenge, getAttestationJWT, dispatch, logger, storeAttestationJWT])

  return { setupAttestation }
}

/**
 * This Splash screen is shown in two scenarios: initial load of the app,
 * and during agent initialization after login.
 */
const CustomSplash: React.FC<SplashProps> = ({ initializeAgent }) => {
  const { walletSecret } = useAuth()
  const { t } = useTranslation()
  const [store] = useStore()
  const initializing = useRef(false)
  const rotation = useRef(new Animated.Value(0)).current
  const fade = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.94)).current
  const [logger, ocaBundleResolver, { enableAttestation }] = useServices([
    TOKENS.UTIL_LOGGER,
    TOKENS.UTIL_OCA_RESOLVER,
    TOKENS.CONFIG,
  ])
  const { setupAttestation } = useSplashAttestation()

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 620,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.2)),
      }),
    ]).start()

    const spinner = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    )
    spinner.start()

    return () => spinner.stop()
  }, [fade, rotation, scale])

  useEffect(() => {
    if (initializing.current || !store.authentication.didAuthenticate) {
      return
    }

    if (!walletSecret) {
      throw new Error('Wallet secret is missing')
    }

    initializing.current = true

    const initAgentAsyncEffect = async (): Promise<void> => {
      try {
        await (ocaBundleResolver as any).checkForUpdates?.()
        await initializeAgent(walletSecret)
      } catch (err: unknown) {
        const error = new BifoldError(
          t('Error.Title1045'),
          t('Error.Message1045'),
          (err as Error)?.message ?? err,
          1045
        )

        DeviceEventEmitter.emit(EventTypes.ERROR_ADDED, error)
        logger.error((err as Error)?.message ?? err)
      }
    }

    initAgentAsyncEffect()
  }, [initializeAgent, ocaBundleResolver, logger, walletSecret, t, store.authentication.didAuthenticate, setupAttestation])

  useEffect(() => {
    if (!store.authentication.didAuthenticate) {
      return
    }

    const initAttestation = async (): Promise<void> => {
      try {
        await setupAttestation()
      } catch (err) {
        const error = new BifoldError(
          t('Error.GenericError.Title'),
          t('Error.GenericError.Message'),
          (err as Error)?.message ?? err,
          1000
        )
        DeviceEventEmitter.emit(EventTypes.ERROR_ADDED, error)
        logger.error((err as Error)?.message ?? err)
      }
    }

    initAttestation()
  }, [setupAttestation, enableAttestation, logger, store.authentication.didAuthenticate, t])

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <RNStatusBar barStyle="dark-content" backgroundColor={onboardingColors.white} />
      <View style={styles.gradientLayer} />
      <View style={styles.gridPattern}>{Array.from({ length: 28 }).map((_, index) => <View key={index} style={styles.gridDot} />)}</View>
      <View style={styles.networkLayer}>
        <View style={[styles.node, styles.nodeOne]} />
        <View style={[styles.node, styles.nodeTwo]} />
        <View style={[styles.node, styles.nodeThree]} />
        <View style={[styles.networkLine, styles.lineOne]} />
        <View style={[styles.networkLine, styles.lineTwo]} />
      </View>
      <View style={styles.waveOne} />
      <View style={styles.waveTwo} />

      <View style={styles.content}>
        <Animated.View style={[styles.centerContent, { opacity: fade, transform: [{ scale }] }]}>
          <View style={styles.logoCard}>
            <View style={styles.logoMark}>
              <View style={styles.logoTop} />
              <View style={styles.logoMiddle} />
              <View style={styles.logoBottom} />
            </View>
          </View>

          <Text style={styles.appName}>SSI Wallet</Text>
          <Text style={styles.loadingText}>Preparing your secure wallet...</Text>

          <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]}>
            <View style={styles.spinnerTrack} />
            <View style={styles.spinnerArc} />
          </Animated.View>
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: onboardingColors.white,
  },
  gradientLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: onboardingColors.backgroundSoft,
    opacity: 0.86,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 44,
  },
  logoCard: {
    width: 136,
    height: 136,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: onboardingColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B3B8F',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 34,
    elevation: 12,
  },
  logoMark: {
    width: 72,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTop: {
    width: 52,
    height: 24,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    backgroundColor: onboardingColors.primaryBlue,
    transform: [{ translateY: 4 }],
  },
  logoMiddle: {
    width: 36,
    height: 18,
    borderRadius: 12,
    backgroundColor: '#2F8BFF',
    transform: [{ rotate: '-12deg' }],
    marginVertical: -2,
  },
  logoBottom: {
    width: 52,
    height: 24,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: onboardingColors.secondaryBlue,
    transform: [{ translateY: -4 }],
  },
  appName: {
    marginTop: 30,
    color: onboardingColors.darkNavy,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7A99',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  spinner: {
    width: 34,
    height: 34,
    marginTop: 28,
  },
  spinnerTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: '#E4EEFF',
  },
  spinnerArc: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 17,
    borderWidth: 3,
    borderLeftColor: onboardingColors.primaryBlue,
    borderTopColor: onboardingColors.primaryBlue,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  gridPattern: {
    position: 'absolute',
    top: '28%',
    alignSelf: 'center',
    width: 240,
    height: 170,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    opacity: 0.12,
  },
  gridDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: onboardingColors.secondaryBlue,
  },
  networkLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
  },
  node: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: onboardingColors.primaryBlue,
  },
  nodeOne: {
    top: '20%',
    left: '17%',
  },
  nodeTwo: {
    top: '27%',
    right: '18%',
  },
  nodeThree: {
    bottom: '28%',
    left: '24%',
  },
  networkLine: {
    position: 'absolute',
    height: 1,
    borderStyle: 'dotted',
    borderWidth: 1,
    borderColor: onboardingColors.secondaryBlue,
  },
  lineOne: {
    top: '22%',
    left: '19%',
    width: 110,
    transform: [{ rotate: '-12deg' }],
  },
  lineTwo: {
    bottom: '31%',
    left: '27%',
    width: 140,
    transform: [{ rotate: '18deg' }],
  },
  waveOne: {
    position: 'absolute',
    bottom: -95,
    left: -70,
    width: 330,
    height: 190,
    borderRadius: 160,
    backgroundColor: '#EEF6FF',
    opacity: 0.82,
    transform: [{ rotate: '-8deg' }],
  },
  waveTwo: {
    position: 'absolute',
    bottom: -120,
    right: -90,
    width: 360,
    height: 210,
    borderRadius: 180,
    backgroundColor: '#EAF3FF',
    opacity: 0.7,
    transform: [{ rotate: '10deg' }],
  },
})

export default CustomSplash
