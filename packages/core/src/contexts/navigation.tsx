import { NavigationContainer } from '@react-navigation/native'
import type { useNavigationContainerRef } from '@react-navigation/native'
import React from 'react'
import { useTheme } from './theme'

export interface NavContainerProps extends React.PropsWithChildren {
  navigationRef: ReturnType<typeof useNavigationContainerRef> | null
}

// Create context for navigation ref
export const NavigationRefContext = createContext<React.RefObject<NavigationContainerRef<any>> | null>(null)

// Custom hook to access navigation ref
export const useNavigationRef = () => {
  return useContext(NavigationRefContext)
}

const NavContainer = ({ navigationRef, children }: NavContainerProps) => {
  const { NavigationTheme } = useTheme()

  return (
    <NavigationRefContext.Provider value={navigationRef}>
      <NavigationContainer ref={navigationRef} theme={NavigationTheme}>
        {children}
      </NavigationContainer>
    </NavigationRefContext.Provider>
  )
}

export default NavContainer
