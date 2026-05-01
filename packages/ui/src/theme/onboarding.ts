export const onboardingColors = {
  background: '#FFFFFF',
  backgroundSoft: '#F8FBFF',
  backgroundBlue: '#EEF6FF',
  primaryBlue: '#0B6DFF',
  secondaryBlue: '#3B82F6',
  darkNavy: '#07133F',
  bodyText: '#5B6B8A',
  border: '#D8E6FF',
  successGreen: '#22C55E',
  softGreen: '#ECFDF5',
  softYellow: '#FFF7E6',
  lightGray: '#D9DEE8',
  white: '#FFFFFF',
} as const

export const onboardingSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const onboardingRadius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
} as const

export const onboardingShadow = {
  shadowColor: '#0B3B8F',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.1,
  shadowRadius: 24,
  elevation: 8,
} as const

export const onboardingTypography = {
  appName: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  headline: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700' as const,
  },
} as const
