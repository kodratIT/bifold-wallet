import { useState, useCallback, useMemo } from 'react'

export interface DisclosableClaim {
  key: string
  field: { label?: string; value: unknown }
  isRequired: boolean
}

export interface UseClaimSelectionReturn {
  selectedClaims: Record<string, boolean>
  handleClaimToggle: (claimName: string, value: boolean) => void
  getDisclosedClaims: (allKeys: string[]) => string[]
  resetSelection: () => void
  isAnyClaimChecked: boolean
  isClaimChecked: (claimKey: string) => boolean
}

export function useClaimSelection(): UseClaimSelectionReturn {
  const [selectedClaims, setSelectedClaims] = useState<Record<string, boolean>>({})

  const handleClaimToggle = useCallback((claimName: string, value: boolean) => {
    setSelectedClaims((prev) => ({ ...prev, [claimName]: value }))
  }, [])

  const resetSelection = useCallback(() => {
    setSelectedClaims({})
  }, [])

  const getDisclosedClaims = useCallback(
    (allKeys: string[]): string[] => {
      return allKeys.filter((key) => selectedClaims[key] === true)
    },
    [selectedClaims]
  )

  const isClaimChecked = useCallback(
    (claimKey: string): boolean => {
      return selectedClaims[claimKey] ?? false
    },
    [selectedClaims]
  )

  const isAnyClaimChecked = useMemo(
    () => Object.values(selectedClaims).some((v) => v === true),
    [selectedClaims]
  )

  return {
    selectedClaims,
    handleClaimToggle,
    getDisclosedClaims,
    resetSelection,
    isAnyClaimChecked,
    isClaimChecked,
  }
}
