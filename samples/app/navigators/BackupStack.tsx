import { createStackNavigator } from '@react-navigation/stack'
import React from 'react'
import { BackupWalletScreen, RestoreWalletScreen } from '@bifold/backup'

export type BackupStackParams = {
  BackupWallet: undefined
  RestoreWallet: undefined
}

const Stack = createStackNavigator<BackupStackParams>()

const BackupStack: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="BackupWallet" component={BackupWalletScreen} options={{ title: 'Backup Wallet' }} />
      <Stack.Screen name="RestoreWallet" component={RestoreWalletScreen} options={{ title: 'Restore Wallet' }} />
    </Stack.Navigator>
  )
}

export default BackupStack
