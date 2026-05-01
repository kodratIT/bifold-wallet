import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { WalletSecret } from '@bifold/core'

export type SplashProps = {
  initializeAgent: (walletSecret: WalletSecret) => Promise<void>
}

const { width, height } = Dimensions.get('window')

const CustomSplash: React.FC<SplashProps> = ({ initializeAgent }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.5)),
      }),
    ]).start()

    // Pulse animation for orbit ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    ).start()
  }, [fadeAnim, slideAnim, scaleAnim, pulseAnim])

  return (
    <SafeAreaView style={styles.container}>
      {/* Background subtle gradient overlay */}
      <View style={styles.gradientOverlay} />

      {/* Background network nodes */}
      <View style={styles.networkBackground}>
        <View style={[styles.node, styles.node1]} />
        <View style={[styles.node, styles.node2]} />
        <View style={[styles.node, styles.node3]} />
        <View style={[styles.nodeLine, styles.line1]} />
        <View style={[styles.nodeLine, styles.line2]} />
      </View>

      {/* Main Content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* App Icon */}
        <Animated.View
          style={[
            styles.iconContainer,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.iconSquare}>
            <View style={styles.logoS}>
              <View style={styles.logoSTop} />
              <View style={styles.logoSBottom} />
            </View>
          </View>
        </Animated.View>

        {/* Title */}
        <Text style={styles.title}>SSI Wallet</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          Aman. Privat. Kendali di Tanganmu.
        </Text>

        {/* 3D Wallet Illustration */}
        <Animated.View
          style={[styles.walletContainer, { transform: [{ scale: pulseAnim }] }]}
        >
          {/* Orbit ring */}
          <View style={styles.orbitRing} />

          {/* Floating security elements */}
          <View style={styles.shieldBadge}>
            <View style={styles.shieldIcon}>
              <View style={styles.checkmark} />
            </View>
          </View>

          <View style={styles.lockBadge}>
            <View style={styles.lockBody}>
              <View style={styles.lockShackle} />
            </View>
          </View>

          <View style={styles.fingerprintBadge}>
            <View style={styles.fprintLines} />
          </View>

          {/* Main wallet body */}
          <View style={styles.walletBody}>
            <View style={styles.walletTop} />

            {/* Identity card peeking out */}
            <View style={styles.idCard}>
              <View style={styles.idCardHeader}>
                <View style={styles.idAvatar}>
                  <View style={styles.idAvatarInner} />
                </View>
                <View style={styles.idLines}>
                  <View style={styles.idLine1} />
                  <View style={styles.idLine2} />
                </View>
              </View>
              <View style={styles.idLabelContainer}>
                <Text style={styles.idLabel}>IDENTITAS DIGITAL</Text>
              </View>
            </View>

            {/* Wallet front details */}
            <View style={styles.walletFront}>
              <View style={styles.walletChip} />
              <View style={styles.walletDetailLine} />
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Bottom pagination dots */}
      <Animated.View style={[styles.dotsContainer, { opacity: fadeAnim }]}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBFF',
    position: 'relative',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    opacity: 0.4,
  },
  networkBackground: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.06,
  },
  node: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  node1: {
    top: height * 0.12,
    left: width * 0.15,
  },
  node2: {
    top: height * 0.22,
    right: width * 0.2,
  },
  node3: {
    bottom: height * 0.25,
    left: width * 0.25,
  },
  nodeLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#3B82F6',
    opacity: 0.3,
  },
  line1: {
    top: height * 0.14,
    left: width * 0.17,
    width: width * 0.25,
    transform: [{ rotate: '-15deg' }],
  },
  line2: {
    top: height * 0.24,
    left: width * 0.22,
    width: width * 0.35,
    transform: [{ rotate: '25deg' }],
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconSquare: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  logoS: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoSTop: {
    width: 28,
    height: 14,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#3B82F6',
    marginBottom: -4,
  },
  logoSBottom: {
    width: 28,
    height: 14,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    backgroundColor: '#60A5FA',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6D8DFB',
    textAlign: 'center',
    marginBottom: 40,
  },
  walletContainer: {
    width: 220,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  orbitRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },
  walletBody: {
    width: 160,
    height: 110,
    position: 'relative',
    alignItems: 'center',
  },
  walletTop: {
    position: 'absolute',
    top: -10,
    width: 140,
    height: 30,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#EFF6FF',
    zIndex: 1,
  },
  idCard: {
    position: 'absolute',
    top: -35,
    width: 130,
    height: 85,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    zIndex: 2,
    padding: 12,
  },
  idCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  idAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  idAvatarInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#60A5FA',
    opacity: 0.5,
  },
  idLines: {
    flex: 1,
    justifyContent: 'center',
  },
  idLine1: {
    width: '70%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DBEAFE',
    marginBottom: 6,
  },
  idLine2: {
    width: '50%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EFF6FF',
  },
  idLabelContainer: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  idLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: 1,
  },
  walletFront: {
    position: 'absolute',
    bottom: 0,
    width: 160,
    height: 90,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
    zIndex: 3,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletChip: {
    width: 32,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#FCD34D',
    marginRight: 12,
    opacity: 0.6,
  },
  walletDetailLine: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
  },
  shieldBadge: {
    position: 'absolute',
    top: 10,
    left: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  shieldIcon: {
    width: 18,
    height: 20,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    width: 8,
    height: 4,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
    marginTop: -2,
  },
  lockBadge: {
    position: 'absolute',
    top: 20,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  lockBody: {
    width: 14,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#60A5FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  lockShackle: {
    position: 'absolute',
    top: -6,
    width: 10,
    height: 8,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#60A5FA',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  fingerprintBadge: {
    position: 'absolute',
    bottom: 20,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  fprintLines: {
    width: 18,
    height: 22,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D7DEE8',
  },
  dotActive: {
    backgroundColor: '#3B82F6',
    width: 24,
    borderRadius: 4,
  },
})

export default CustomSplash
