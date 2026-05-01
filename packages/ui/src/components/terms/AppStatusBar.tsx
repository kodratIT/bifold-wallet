import React from 'react'
import { StatusBar } from 'react-native'

import { onboardingColors } from '../../theme/onboarding'

export const AppStatusBar: React.FC = () => {
  return <StatusBar barStyle="dark-content" backgroundColor={onboardingColors.white} />
}
