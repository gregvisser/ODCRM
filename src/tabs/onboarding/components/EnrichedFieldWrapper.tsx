import type { ReactNode } from 'react'
import { Box, Button, HStack, Stack, Text } from '@chakra-ui/react'
import type { FieldEnrichmentActive, FieldEnrichmentEntry, FieldEnrichmentMode } from '../../../utils/fieldEnrichment'
import { normalizeFieldEnrichmentEntry } from '../../../utils/fieldEnrichment'

export type EnrichedFieldRenderParams<T> = {
  value: T
  onChange: (next: T) => void
  isReadOnly?: boolean
}

export function EnrichedFieldWrapper<T>(props: {
  originalValue: T
  enhancedValue: T | null | undefined
  entry: FieldEnrichmentEntry<T> | null | undefined
  onChangeEntry: (next: FieldEnrichmentEntry<T>) => void
  onApplyActiveValue: (nextActive: T) => void
  onRequestEnhanced?: () => Promise<T | null> | T | null
  renderInput: (params: EnrichedFieldRenderParams<T>) => ReactNode
  renderEnhancedFallback?: (value: T | null | undefined) => ReactNode
  isReadOnly?: boolean
}) {
  const normalized = normalizeFieldEnrichmentEntry(props.entry)
  const mode: FieldEnrichmentMode = normalized.mode ?? 'original'
  const active: FieldEnrichmentActive = normalized.active ?? (mode === 'enhanced' ? 'enhanced' : 'original')

  const setMode = (nextMode: FieldEnrichmentMode) => {
    const next: FieldEnrichmentEntry<T> = {
      ...normalized,
      // If the record came from legacy data (no entry), capture the current original before swapping modes.
      original: normalized.original ?? props.originalValue,
      mode: nextMode,
    }
    if (nextMode === 'enhanced') next.active = 'enhanced'
    if (nextMode === 'original') next.active = 'original'
    if (nextMode === 'both') next.active = next.active ?? 'original'
    props.onChangeEntry(next)
  }

  const setActive = (nextActive: FieldEnrichmentActive) => {
    const next: FieldEnrichmentEntry<T> = { ...normalized, mode: 'both', active: nextActive }
    props.onChangeEntry(next)
    const valueToApply = nextActive === 'enhanced' ? (props.enhancedValue ?? props.originalValue) : props.originalValue
    props.onApplyActiveValue(valueToApply)
  }

  const onClickOriginal = () => {
    setMode('original')
    props.onApplyActiveValue(props.originalValue)
  }

  const onClickEnhanced = async () => {
    let enhanced = props.enhancedValue ?? null
    if (enhanced == null && props.onRequestEnhanced) {
      try {
        enhanced = await props.onRequestEnhanced()
      } catch {
        enhanced = null
      }
      if (enhanced != null) {
        props.onChangeEntry({ ...normalized, original: normalized.original ?? props.originalValue, enhanced })
      }
    }

    setMode('enhanced')
    props.onApplyActiveValue((enhanced ?? props.originalValue) as any)
  }

  const onClickBoth = async () => {
    // If the user selects "Both" but we don't have an enhanced value yet, allow a lazy fetch.
    if (props.enhancedValue == null && props.onRequestEnhanced) {
      try {
        const enhanced = await props.onRequestEnhanced()
        if (enhanced != null) {
          props.onChangeEntry({
            ...normalized,
            original: normalized.original ?? props.originalValue,
            enhanced,
            mode: 'both',
            active: normalized.active ?? 'original',
          })
          return
        }
      } catch {
        // ignore
      }
    }
    setMode('both')
  }

  const onChangeOriginalValue = (nextOriginal: T) => {
    const nextEntry: FieldEnrichmentEntry<T> = { ...normalized, original: nextOriginal }
    props.onChangeEntry(nextEntry)
    if (mode === 'original' || (mode === 'both' && active === 'original')) {
      props.onApplyActiveValue(nextOriginal)
    }
  }

  const renderEnhancedMissing = () => {
    if (props.renderEnhancedFallback) return props.renderEnhancedFallback(props.enhancedValue)
    return (
      <Text fontSize="sm" color="gray.500">
        No enhanced value yet.
      </Text>
    )
  }

  const resolvedEnhanced = props.enhancedValue ?? props.originalValue
  const activeValue =
    mode === 'enhanced'
      ? resolvedEnhanced
      : mode === 'both'
        ? active === 'enhanced'
          ? resolvedEnhanced
          : props.originalValue
        : props.originalValue

  const isInputReadOnly =
    props.isReadOnly || mode === 'enhanced' || (mode === 'both' && active === 'enhanced' && props.enhancedValue != null)

  return (
    <Stack spacing={2}>
      <HStack spacing={2} flexWrap="wrap">
        <Button
          size="xs"
          variant={mode === 'original' ? 'solid' : 'outline'}
          colorScheme={mode === 'original' ? 'blue' : 'gray'}
          onClick={onClickOriginal}
          isDisabled={props.isReadOnly}
        >
          Original
        </Button>
        <Button
          size="xs"
          variant={mode === 'enhanced' ? 'solid' : 'outline'}
          colorScheme={mode === 'enhanced' ? 'blue' : 'gray'}
          onClick={() => void onClickEnhanced()}
          isDisabled={props.isReadOnly}
        >
          Enhanced
        </Button>
        <Button
          size="xs"
          variant={mode === 'both' ? 'solid' : 'outline'}
          colorScheme={mode === 'both' ? 'blue' : 'gray'}
          onClick={() => void onClickBoth()}
          isDisabled={props.isReadOnly}
        >
          Both
        </Button>
      </HStack>

      {props.renderInput({
        value: activeValue as any,
        onChange: onChangeOriginalValue as any,
        isReadOnly: isInputReadOnly,
      })}

      {(mode === 'enhanced' || mode === 'both') && props.enhancedValue == null && renderEnhancedMissing()}

      {mode === 'both' && (
        <Stack spacing={2}>
          <Box borderWidth="1px" borderRadius="md" p={2}>
            <Text fontSize="xs" color="gray.500" mb={1}>
              Original
            </Text>
            <Text fontSize="sm" whiteSpace="pre-wrap">
              {String(props.originalValue ?? '')}
            </Text>
            <Button mt={2} size="xs" onClick={() => setActive('original')} isDisabled={props.isReadOnly} variant="outline">
              Use Original
            </Button>
          </Box>

          <Box borderWidth="1px" borderRadius="md" p={2}>
            <Text fontSize="xs" color="gray.500" mb={1}>
              Enhanced
            </Text>
            <Text fontSize="sm" whiteSpace="pre-wrap">
              {props.enhancedValue == null ? '' : String(props.enhancedValue)}
            </Text>
            <Button
              mt={2}
              size="xs"
              onClick={() => setActive('enhanced')}
              isDisabled={props.isReadOnly || props.enhancedValue == null}
              variant="outline"
            >
              Use Enhanced
            </Button>
          </Box>
        </Stack>
      )}
    </Stack>
  )
}

