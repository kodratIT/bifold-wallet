import React, { useCallback, useEffect, useState } from 'react'
import { Alert, AppState, DeviceEventEmitter, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { check, PERMISSIONS, PermissionStatus, request, RESULTS } from 'react-native-permissions'
import Keychain, { BIOMETRY_TYPE, getSupportedBiometryType } from 'react-native-keychain'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BifoldError, DispatchAction, EventTypes, useAuth, useStore } from '@bifold/core'

import { BiometryHero, BiometryOptionCard } from '../components/biometry'
import { AppHeader, PrimaryButton } from '../components/onboarding'
import { AppStatusBar, BackgroundDecorations } from '../components/terms'
import { onboardingColors, onboardingTypography } from '../theme/onboarding'

const BIOMETRY_PERMISSION = PERMISSIONS.IOS.FACE_ID

const CustomBiometry: React.FC = () => {
  const [store, dispatch] = useStore()
  const { commitWalletToKeychain, isBiometricsActive } = useAuth()
  const [biometryEnabled, setBiometryEnabled] = useState(store.preferences.useBiometry)
  const [biometryAvailable, setBiometryAvailable] = useState(false)
  const [continueEnabled, setContinueEnabled] = useState(true)

  const emitBiometryError = useCallback((err: unknown) => {
    const error = new BifoldError(
      'Unable to access biometrics',
      'There was a problem while attempting to access this device biometrics.',
      (err as Error)?.message ?? err,
      1050
    )
    DeviceEventEmitter.emit(EventTypes.ERROR_ADDED, error)
  }, [])

  const refreshBiometryAvailability = useCallback(async () => {
    try {
      const active = await Keychain.getSupportedBiometryType()
      setBiometryAvailable(Boolean(active))
    } catch (err) {
      emitBiometryError(err)
    }
  }, [emitBiometryError])

  useEffect(() => {
    isBiometricsActive()
      .then((res) => setBiometryAvailable(res))
      .catch(emitBiometryError)
  }, [emitBiometryError, isBiometricsActive])

  useEffect(() => {
    const appStateListener = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        await refreshBiometryAvailability()
      }
    })

    return () => appStateListener.remove()
  }, [refreshBiometryAvailability])

  const showSettingsPrompt = useCallback((title: string, message: string) => {
    Alert.alert(title, message, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ])
  }, [])

  const onRequestSystemBiometrics = useCallback(
    async (newToggleValue: boolean) => {
      const permissionResult: PermissionStatus = await request(BIOMETRY_PERMISSION)
      if (permissionResult === RESULTS.GRANTED || permissionResult === RESULTS.LIMITED) {
        setBiometryEnabled(newToggleValue)
      }
    },
    []
  )

  const onCheckSystemBiometrics = useCallback(async (): Promise<PermissionStatus> => {
    if (Platform.OS === 'android') {
      return biometryAvailable ? RESULTS.GRANTED : RESULTS.UNAVAILABLE
    }

    if (Platform.OS === 'ios') {
      return check(BIOMETRY_PERMISSION)
    }

    return RESULTS.UNAVAILABLE
  }, [biometryAvailable])

  const toggleBiometry = useCallback(async () => {
    const newValue = !biometryEnabled

    if (!newValue) {
      setBiometryEnabled(false)
      return
    }

    try {
      const permissionResult = await onCheckSystemBiometrics()
      const supportedType = await getSupportedBiometryType()

      switch (permissionResult) {
        case RESULTS.GRANTED:
        case RESULTS.LIMITED:
          setBiometryEnabled(true)
          break
        case RESULTS.UNAVAILABLE:
          if (Platform.OS === 'ios' && supportedType === BIOMETRY_TYPE.TOUCH_ID) {
            setBiometryEnabled(true)
          } else {
            showSettingsPrompt(
              'Set up biometrics',
              'To unlock SSI Wallet with biometrics, please set up biometrics in your device settings.'
            )
          }
          break
        case RESULTS.BLOCKED:
          showSettingsPrompt(
            'Allow biometrics',
            'To unlock SSI Wallet with biometrics, please allow biometric access in your device settings.'
          )
          break
        case RESULTS.DENIED:
          await onRequestSystemBiometrics(true)
          break
        default:
          break
      }
    } catch (err) {
      emitBiometryError(err)
    }
  }, [biometryEnabled, emitBiometryError, onCheckSystemBiometrics, onRequestSystemBiometrics, showSettingsPrompt])

  const continueTouched = useCallback(async () => {
    setContinueEnabled(false)

    try {
      await commitWalletToKeychain(biometryEnabled)
      dispatch({
        type: DispatchAction.USE_BIOMETRY,
        payload: [biometryEnabled],
      })
    } finally {
      setContinueEnabled(true)
    }
  }, [biometryEnabled, commitWalletToKeychain, dispatch])

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <AppStatusBar />
      <BackgroundDecorations />
      <View style={styles.gradientLayer} />

      <View style={styles.container}>
        <AppHeader />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} style={styles.scrollView}>
          <View style={styles.copyBlock}>
            <Text style={styles.title}>Unlock with biometrics</Text>
            <Text style={styles.subtitle}>
              Use your fingerprint or face recognition for faster access while keeping your wallet protected by your PIN.
            </Text>
          </View>

          <BiometryHero />
          <BiometryOptionCard enabled={biometryEnabled} available={biometryAvailable} onToggle={toggleBiometry} />
        </ScrollView>

        <View style={styles.bottomArea}>
          <PrimaryButton title="Continue" onPress={continueTouched} disabled={!continueEnabled} style={styles.continueButton} />
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: onboardingColors.white,
  },
  gradientLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: onboardingColors.backgroundSoft,
    opacity: 0.72,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 30,
    paddingBottom: 24,
    gap: 18,
  },
  copyBlock: {
    gap: 10,
  },
  title: {
    ...onboardingTypography.headline,
    color: onboardingColors.darkNavy,
  },
  subtitle: {
    ...onboardingTypography.body,
    color: onboardingColors.bodyText,
  },
  bottomArea: {
    paddingTop: 14,
    paddingBottom: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(248, 251, 255, 0.96)',
  },
  continueButton: {
    minWidth: 180,
  },
})

export default CustomBiometry
