import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, DeviceEventEmitter, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { BifoldError, DispatchAction, EventTypes, OnboardingStackParams, Screens, useAuth, useStore } from '@bifold/core'

import { AppHeader, PageIndicator, PrimaryButton } from '../components/onboarding'
import { PinExplanationScreen, PinSetupScreen } from '../components/pin'
import { AppStatusBar, BackgroundDecorations } from '../components/terms'
import { onboardingColors } from '../theme/onboarding'

const PIN_LENGTH = 6

type CustomPinSetupFlowProps = {
  setAuthenticated: (status: boolean) => void
}

const CustomPinSetupFlow: React.FC<CustomPinSetupFlowProps> = ({ setAuthenticated }) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const fadeAnim = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const { setPIN: setWalletPIN } = useAuth()
  const [, dispatch] = useStore()
  const navigation = useNavigation<StackNavigationProp<OnboardingStackParams>>()

  const isPinScreen = activeIndex === 1
  const canCreatePin = pin.length === PIN_LENGTH && confirmPin.length === PIN_LENGTH && pin === confirmPin && !isLoading

  useEffect(() => {
    navigation.setOptions({ headerShown: false })
  }, [navigation])

  useEffect(() => {
    fadeAnim.setValue(0)
    slideAnim.setValue(18)

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start()
  }, [activeIndex, fadeAnim, slideAnim])

  const goBackToTerms = useCallback(() => {
    dispatch({
      type: DispatchAction.DID_AGREE_TO_TERMS,
      payload: [{ DidAgreeToTerms: false }],
    })
    navigation.navigate(Screens.Terms)
  }, [dispatch, navigation])

  const onBackPressed = useCallback(() => {
    if (isPinScreen) {
      setPin('')
      setConfirmPin('')
      setActiveIndex(0)
      return
    }

    goBackToTerms()
  }, [goBackToTerms, isPinScreen])

  const onContinuePressed = useCallback(() => {
    setActiveIndex(1)
  }, [])

  const onCreatePinPressed = useCallback(async () => {
    if (!canCreatePin) {
      return
    }

    setIsLoading(true)
    try {
      await setWalletPIN(pin)
      setAuthenticated(true)
      dispatch({ type: DispatchAction.DID_CREATE_PIN })
    } catch (err: unknown) {
      const error = new BifoldError(
        'Unable to create PIN',
        'There was a problem creating your wallet PIN. Please try again.',
        (err as Error)?.message ?? err,
        1040
      )
      DeviceEventEmitter.emit(EventTypes.ERROR_ADDED, error)
    } finally {
      setIsLoading(false)
    }
  }, [canCreatePin, dispatch, pin, setAuthenticated, setWalletPIN])

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <AppStatusBar />
      <BackgroundDecorations />
      <View style={styles.gradientLayer} />

      <View style={styles.container}>
        <AppHeader />

        {isPinScreen ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.pinKeyboardAvoider}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.pinScrollContent}
              style={styles.scrollView}
            >
              <Animated.View
                style={[
                  styles.animatedContent,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateX: slideAnim }],
                  },
                ]}
              >
                <PinSetupScreen
                  pin={pin}
                  confirmPin={confirmPin}
                  onPinChange={setPin}
                  onConfirmPinChange={setConfirmPin}
                />
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} style={styles.scrollView}>
            <Animated.View
              style={[
                styles.animatedContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}
            >
              <PinExplanationScreen />
            </Animated.View>
          </ScrollView>
        )}

        <View style={styles.bottomArea}>
          <PageIndicator activeIndex={activeIndex} count={2} />
          <View style={[styles.actionsRow, !isPinScreen && styles.actionsRowCentered]}>
            {isPinScreen ? (
              <Pressable accessibilityRole="button" onPress={onBackPressed} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <Icon name="arrow-left" size={18} color={onboardingColors.bodyText} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            ) : null}
            <PrimaryButton
              title={isPinScreen ? 'Create PIN' : 'Continue'}
              onPress={isPinScreen ? onCreatePinPressed : onContinuePressed}
              disabled={isPinScreen && !canCreatePin}
              style={isPinScreen ? styles.primaryButton : styles.centerPrimaryButton}
            />
          </View>
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
  },
  pinKeyboardAvoider: {
    flex: 1,
  },
  pinScrollContent: {
    flexGrow: 1,
    paddingTop: 24,
    paddingBottom: 24,
  },
  animatedContent: {
    flex: 1,
  },
  bottomArea: {
    gap: 16,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: 'rgba(248, 251, 255, 0.96)',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  actionsRowCentered: {
    justifyContent: 'center',
  },
  backButton: {
    minWidth: 82,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pressed: {
    opacity: 0.72,
  },
  backText: {
    color: onboardingColors.bodyText,
    fontSize: 16,
    fontWeight: '800',
  },
  primaryButton: {
    flex: 1,
    maxWidth: 190,
  },
  centerPrimaryButton: {
    minWidth: 180,
  },
})

export default CustomPinSetupFlow
