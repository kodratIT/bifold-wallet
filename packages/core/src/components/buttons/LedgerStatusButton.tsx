import React, { useCallback, useEffect, useState } from 'react'
import { Alert, TouchableOpacity, View, StyleSheet } from 'react-native'
import { useAgent } from '@bifold/react-hooks'
import { IndyVdrPoolService } from '@credo-ts/indy-vdr'

import { useTranslation } from 'react-i18next'
import { useTheme } from '../../contexts/theme'
import { fetchLedgerNodes, canConnectToHost } from '../../utils/network'

const LedgerStatusButton: React.FC = () => {
  const { agent } = useAgent()
  const { t } = useTranslation()
  const { ColorPalette } = useTheme()
  const [status, setStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown')

  const checkStatus = useCallback(async () => {
    if (!agent) {
      setStatus('disconnected')
      return
    }

    try {
      // Check if pool is open via Credo
      const poolService = agent.dependencyManager.resolve(IndyVdrPoolService)
      const pools = poolService.pools
      const pool = pools.find((p) => p.indyNamespace === 'local')

      if (!pool) {
        setStatus('disconnected')
        return
      }

      const isPoolOpen = pool.isOpen

      // Also try TCP check to genesis nodes
      const nodes = fetchLedgerNodes('local')
      const nodeChecks = await Promise.all(nodes.map((node) => canConnectToHost(node)))
      const anyNodeReachable = nodeChecks.some((c) => c)

      if (isPoolOpen && anyNodeReachable) {
        setStatus('connected')
      } else {
        setStatus('disconnected')
      }
    } catch {
      setStatus('disconnected')
    }
  }, [agent])

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 10000)
    return () => clearInterval(interval)
  }, [checkStatus])

  const onPress = useCallback(() => {
    const nodes = fetchLedgerNodes('local')
    const nodeList = nodes.map((n) => `${n.host}:${n.port}`).join('\n')

    Alert.alert(
      t('LedgerStatus.Title', { defaultValue: 'Ledger Status' }),
      t('LedgerStatus.Message', {
        defaultValue: `Status: ${status === 'connected' ? 'Connected' : status === 'disconnected' ? 'Disconnected' : 'Unknown'}\n\nNodes:\n${nodeList}`,
      })
    )
  }, [status, t])

  const color =
    status === 'connected'
      ? ColorPalette.semantic.success
      : status === 'disconnected'
        ? ColorPalette.semantic.error
        : ColorPalette.grayscale.mediumGrey

  return (
    <TouchableOpacity onPress={onPress} accessibilityLabel={t('LedgerStatus.ButtonLabel', { defaultValue: 'Ledger status' })}>
      <View style={[styles.dot, { backgroundColor: color }]} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
  },
})

export default LedgerStatusButton
