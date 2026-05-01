import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, BackHandler, Pressable, StatusBar as RNStatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { DispatchAction, OnboardingStackParams, useStore } from '@bifold/core'
import type { OnboardingStyleSheet } from '@bifold/core'

import {
  AppHeader,
  FloatingIcon,
  PageIndicator,
  PhoneMockup,
  PrimaryButton,
} from '../components/onboarding'
import { onboardingColors, onboardingTypography } from '../theme/onboarding'

interface OnboardingProps {
  pages: Array<Element>
  nextButtonText: string
  previousButtonText: string
  style: OnboardingStyleSheet
  disableSkip?: boolean
}

type OnboardingSlide = {
  headline: string
  subtitle: string
  mockup: 'credentials' | 'consent' | 'verification'
  floatingIcons: Array<{
    name: string
    style: Record<string, number | string>
    connectorStyle?: Record<string, number | string | Array<{ rotate: string }>>
  }>
}

const slides: OnboardingSlide[] = [
  {
    headline: 'Store your digital identity securely',
    subtitle: 'Keep credentials, verify details, and share only what is needed — always under your control.',
    mockup: 'credentials',
    floatingIcons: [
      { name: 'shield-check', style: { top: '10%', left: '2%' }, connectorStyle: { width: 54, top: 22, left: 40, transform: [{ rotate: '14deg' }] } },
      { name: 'qrcode', style: { top: '38%', right: '0%' }, connectorStyle: { width: 50, top: 22, right: 38, transform: [{ rotate: '-12deg' }] } },
      { name: 'fingerprint', style: { bottom: '14%', left: '8%' }, connectorStyle: { width: 48, top: 22, left: 40, transform: [{ rotate: '-18deg' }] } },
    ],
  },
  {
    headline: 'Share only what matters',
    subtitle: 'Review every request, choose the exact fields to share, and give consent with confidence.',
    mockup: 'consent',
    floatingIcons: [
      { name: 'shield-check', style: { top: '9%', right: '4%' }, connectorStyle: { width: 50, top: 22, right: 38, transform: [{ rotate: '-16deg' }] } },
      { name: 'qrcode', style: { bottom: '18%', left: '0%' }, connectorStyle: { width: 58, top: 22, left: 40, transform: [{ rotate: '-12deg' }] } },
      { name: 'check-decagram', style: { top: '43%', left: '6%' }, connectorStyle: { width: 48, top: 22, left: 40, transform: [{ rotate: '10deg' }] } },
    ],
  },
  {
    headline: 'Verify instantly, anywhere',
    subtitle: 'Use QR, biometrics, or your digital credentials to access services quickly and securely.',
    mockup: 'verification',
    floatingIcons: [
      { name: 'qrcode', style: { top: '8%', left: '2%' }, connectorStyle: { width: 50, top: 22, left: 40, transform: [{ rotate: '12deg' }] } },
      { name: 'fingerprint', style: { top: '32%', right: '0%' }, connectorStyle: { width: 48, top: 22, right: 38, transform: [{ rotate: '-10deg' }] } },
      { name: 'shield-check', style: { bottom: '12%', left: '7%' }, connectorStyle: { width: 54, top: 22, left: 40, transform: [{ rotate: '-14deg' }] } },
      { name: 'lock-check', style: { bottom: '8%', right: '8%' }, connectorStyle: { width: 42, top: 22, right: 38, transform: [{ rotate: '16deg' }] } },
    ],
  },
]

const CustomOnboarding: React.FC<OnboardingProps> = ({ disableSkip = false }) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const fadeAnim = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const [, dispatch] = useStore()
  const navigation = useNavigation<StackNavigationProp<OnboardingStackParams>>()
  const { height } = useWindowDimensions()
  const isCompact = height < 720

  const activeSlide = slides[activeIndex]
  const isLastSlide = activeIndex === slides.length - 1

  useEffect(() => {
    navigation.setOptions({ headerShown: false })
  }, [navigation])

  useEffect(() => {
    fadeAnim.setValue(0)
    slideAnim.setValue(18)

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start()
  }, [activeIndex, fadeAnim, slideAnim])

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        BackHandler.exitApp()
        return true
      }

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress)
      return () => subscription.remove()
    }, [])
  )

  const completeTutorial = useCallback(() => {
    dispatch({
      type: DispatchAction.DID_COMPLETE_TUTORIAL,
    })
  }, [dispatch])

  const goToFinalSlide = useCallback(() => {
    setActiveIndex(slides.length - 1)
  }, [])

  const goNext = useCallback(() => {
    if (isLastSlide) {
      completeTutorial()
      return
    }

    setActiveIndex((current) => Math.min(current + 1, slides.length - 1))
  }, [completeTutorial, isLastSlide])

  const goBack = useCallback(() => {
    setActiveIndex((current) => Math.max(current - 1, 0))
  }, [])

  const bottomLeftAction = useMemo(() => {
    if (isLastSlide) {
      return { label: 'Back', action: goBack, visible: true, icon: 'arrow-left' }
    }

    return { label: 'Skip', action: goToFinalSlide, visible: !disableSkip, icon: undefined }
  }, [disableSkip, goBack, goToFinalSlide, isLastSlide])

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <RNStatusBar barStyle="dark-content" backgroundColor={onboardingColors.white} />
      <View style={styles.gradientTop} />
      <View style={[styles.container, isCompact && styles.containerCompact]}>
        <AppHeader />

        <Animated.View
          style={[
            styles.animatedContent,
            {
              opacity: fadeAnim,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <View style={[styles.copyBlock, isCompact && styles.copyBlockCompact]}>
            <Text style={[styles.headline, isCompact && styles.headlineCompact]}>{activeSlide.headline}</Text>
            <Text style={[styles.subtitle, isCompact && styles.subtitleCompact]}>{activeSlide.subtitle}</Text>
          </View>

          <View style={styles.illustrationArea}>
            <View style={styles.halo} />
            <PhoneMockup variant={activeSlide.mockup} />
            {activeSlide.floatingIcons.map((item) => (
              <FloatingIcon key={`${activeIndex}-${item.name}-${JSON.stringify(item.style)}`} name={item.name} style={item.style as any} connectorStyle={item.connectorStyle as any} />
            ))}
          </View>
        </Animated.View>

        <View style={styles.bottomBar}>
          <PageIndicator activeIndex={activeIndex} />
          <View style={styles.actionsRow}>
            <Pressable
              accessibilityRole="button"
              disabled={!bottomLeftAction.visible}
              onPress={bottomLeftAction.action}
              style={({ pressed }) => [styles.textButton, pressed && styles.textButtonPressed, !bottomLeftAction.visible && styles.hidden]}
            >
              {bottomLeftAction.icon ? <Icon name={bottomLeftAction.icon} size={18} color={onboardingColors.bodyText} /> : null}
              <Text style={styles.textButtonLabel}>{bottomLeftAction.label}</Text>
            </Pressable>
            <PrimaryButton title={isLastSlide ? 'Get Started' : 'Next'} onPress={goNext} />
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
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: onboardingColors.backgroundSoft,
    opacity: 0.86,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 14,
  },
  containerCompact: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  animatedContent: {
    flex: 1,
  },
  copyBlock: {
    marginTop: 28,
    gap: 12,
  },
  copyBlockCompact: {
    marginTop: 18,
    gap: 8,
  },
  headline: {
    ...onboardingTypography.headline,
    color: onboardingColors.darkNavy,
    maxWidth: 330,
  },
  headlineCompact: {
    fontSize: 29,
    lineHeight: 34,
  },
  subtitle: {
    ...onboardingTypography.body,
    color: onboardingColors.bodyText,
    maxWidth: 330,
  },
  subtitleCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  illustrationArea: {
    flex: 1,
    minHeight: 340,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  halo: {
    position: 'absolute',
    width: '78%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: onboardingColors.backgroundBlue,
    opacity: 0.72,
  },
  bottomBar: {
    gap: 18,
    paddingTop: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  textButton: {
    minWidth: 88,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  textButtonPressed: {
    opacity: 0.7,
  },
  hidden: {
    opacity: 0,
  },
  textButtonLabel: {
    color: onboardingColors.bodyText,
    fontSize: 16,
    fontWeight: '800',
  },
})

export default CustomOnboarding
