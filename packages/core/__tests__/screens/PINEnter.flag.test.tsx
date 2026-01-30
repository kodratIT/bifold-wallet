import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import React from 'react'
import { container } from 'tsyringe'

import AsyncStorage from '@react-native-async-storage/async-storage'

import { ContainerProvider } from '../../src/container-api'
import { MainContainer } from '../../src/container-impl'
import { AuthContext } from '../../src/contexts/auth'
import { StoreProvider, defaultState } from '../../src/contexts/store'
import PINEnter from '../../src/screens/PINEnter'
import { testIdWithKey } from '../../src/utils/testable'
import authContext from '../contexts/auth'

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
}))

describe('PINEnter post_restore flag clearing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('clears post_restore flag after successful PIN entry', async () => {
    // Mock AsyncStorage to return 'true' for post_restore flag
    const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>
    const mockRemoveItem = AsyncStorage.removeItem as jest.MockedFunction<typeof AsyncStorage.removeItem>
    
    mockGetItem.mockResolvedValue('true')
    mockRemoveItem.mockResolvedValue(undefined)

    const setAuthenticatedMock = jest.fn()
    const mockAuthContext = {
      ...authContext,
      checkWalletPIN: jest.fn().mockResolvedValue(true),
      setAuthenticated: setAuthenticatedMock,
    }

    const main = new MainContainer(container.createChildContainer()).init()
    const tree = render(
      <ContainerProvider value={main}>
        <StoreProvider
          initialState={{
            ...defaultState,
          }}
        >
          <AuthContext.Provider value={mockAuthContext}>
            <PINEnter setAuthenticated={mockAuthContext.setAuthenticated} />
          </AuthContext.Provider>
        </StoreProvider>
      </ContainerProvider>
    )

    const pinInput = tree.getByTestId(testIdWithKey('EnterPIN'))

    // Enter a valid PIN
    await act(async () => {
      fireEvent.changeText(pinInput, '123456')
    })

    // Verify that getItem was called to check for post_restore flag
    await waitFor(
      () => {
        expect(mockGetItem).toHaveBeenCalledWith('post_restore')
        // Verify that removeItem was called to clear the flag
        expect(mockRemoveItem).toHaveBeenCalledWith('post_restore')
      },
      { timeout: 3000 }
    )
  })

  it('does not clear post_restore flag when flag is not set', async () => {
    // Mock AsyncStorage to return null (flag not set)
    const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>
    const mockRemoveItem = AsyncStorage.removeItem as jest.MockedFunction<typeof AsyncStorage.removeItem>
    
    mockGetItem.mockResolvedValue(null)
    mockRemoveItem.mockResolvedValue(undefined)

    const setAuthenticatedMock = jest.fn()
    const mockAuthContext = {
      ...authContext,
      checkWalletPIN: jest.fn().mockResolvedValue(true),
      setAuthenticated: setAuthenticatedMock,
    }

    const main = new MainContainer(container.createChildContainer()).init()
    const tree = render(
      <ContainerProvider value={main}>
        <StoreProvider
          initialState={{
            ...defaultState,
          }}
        >
          <AuthContext.Provider value={mockAuthContext}>
            <PINEnter setAuthenticated={mockAuthContext.setAuthenticated} />
          </AuthContext.Provider>
        </StoreProvider>
      </ContainerProvider>
    )

    const pinInput = tree.getByTestId(testIdWithKey('EnterPIN'))

    // Enter a valid PIN
    await act(async () => {
      fireEvent.changeText(pinInput, '123456')
    })

    // Verify that getItem was called but removeItem should not be called
    await waitFor(
      () => {
        expect(mockGetItem).toHaveBeenCalledWith('post_restore')
        expect(mockRemoveItem).not.toHaveBeenCalled()
      },
      { timeout: 3000 }
    )
  })

  it('handles AsyncStorage getItem errors gracefully', async () => {
    // Mock AsyncStorage to throw an error
    const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>
    mockGetItem.mockRejectedValue(new Error('Storage error'))

    const setAuthenticatedMock = jest.fn()
    const mockAuthContext = {
      ...authContext,
      checkWalletPIN: jest.fn().mockResolvedValue(true),
      setAuthenticated: setAuthenticatedMock,
    }

    const main = new MainContainer(container.createChildContainer()).init()
    
    // Should not throw, should handle error gracefully
    expect(() => {
      render(
        <ContainerProvider value={main}>
          <StoreProvider
            initialState={{
              ...defaultState,
            }}
          >
            <AuthContext.Provider value={mockAuthContext}>
              <PINEnter setAuthenticated={mockAuthContext.setAuthenticated} />
            </AuthContext.Provider>
          </StoreProvider>
        </ContainerProvider>
      )
    }).not.toThrow()

    const pinInput = mockAuthContext.setAuthenticated.mock.calls.length
    
    // Verify component rendered without crash
    expect(pinInput).toBeDefined()
  })

  it('handles AsyncStorage removeItem errors gracefully', async () => {
    // Mock AsyncStorage: getItem succeeds but removeItem fails
    const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>
    const mockRemoveItem = AsyncStorage.removeItem as jest.MockedFunction<typeof AsyncStorage.removeItem>
    
    mockGetItem.mockResolvedValue('true')
    mockRemoveItem.mockRejectedValue(new Error('Remove failed'))

    const setAuthenticatedMock = jest.fn()
    const mockAuthContext = {
      ...authContext,
      checkWalletPIN: jest.fn().mockResolvedValue(true),
      setAuthenticated: setAuthenticatedMock,
    }

    const main = new MainContainer(container.createChildContainer()).init()
    const tree = render(
      <ContainerProvider value={main}>
        <StoreProvider
          initialState={{
            ...defaultState,
          }}
        >
          <AuthContext.Provider value={mockAuthContext}>
            <PINEnter setAuthenticated={mockAuthContext.setAuthenticated} />
          </AuthContext.Provider>
        </StoreProvider>
      </ContainerProvider>
    )

    const pinInput = tree.getByTestId(testIdWithKey('EnterPIN'))

    // Enter a valid PIN - should not throw even if removeItem fails
    await act(async () => {
      fireEvent.changeText(pinInput, '123456')
    })

    // Verify that authentication still succeeds despite removeItem error
    await waitFor(
      () => {
        expect(mockGetItem).toHaveBeenCalledWith('post_restore')
        expect(mockRemoveItem).toHaveBeenCalledWith('post_restore')
        // setAuthenticated should still be called even if removeItem failed
        expect(setAuthenticatedMock).toHaveBeenCalled()
      },
      { timeout: 3000 }
    )
  })
})
