import { useEffect, useRef, useState } from 'react'
import { Box, Button, HStack, IconButton, Image, Text, VStack } from '@chakra-ui/react'
import { CloseIcon } from '@chakra-ui/icons'

const DEFAULT_STORAGE_KEY = 'odcrm_header_image_data_url'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}

export function HeaderImagePicker({
  storageKey = DEFAULT_STORAGE_KEY,
  variant = 'logo',
  maxHeightPx = 120,
  /**
   * Hide edit controls from normal UI. Toggle with Ctrl+Shift+L (stored in localStorage).
   * This is UI/UX gating only (not security). True enforcement requires auth/roles.
   */
  lockEdits = true,
  /**
   * Whether to show a hint when not editing (e.g. "press Ctrl+Shift+L").
   */
  showLockedHint = false,
}: {
  storageKey?: string
  variant?: 'logo' | 'default'
  maxHeightPx?: number
  lockEdits?: boolean
  showLockedHint?: boolean
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState<boolean>(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) setDataUrl(stored)
    } catch {
      // ignore
    }
  }, [storageKey])

  // Owner-only-ish UX: unlock edit mode via keyboard shortcut.
  // Ctrl+Shift+L toggles edit controls.
  // NOTE: We intentionally keep this session-only (sessionStorage) so "Change Logo"
  // never appears by default after refresh, even on shared machines.
  useEffect(() => {
    if (!lockEdits) {
      setIsEditing(true)
      return
    }

    try {
      // Back-compat: if an old localStorage unlock exists, clear it so edit controls
      // don't stick around permanently.
      localStorage.removeItem(`${storageKey}__editing`)
    } catch {
      // ignore
    }

    try {
      const stored = sessionStorage.getItem(`${storageKey}__editing`)
      if (stored === 'true') setIsEditing(true)
    } catch {
      // ignore
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault()
        setIsEditing((prev) => {
          const next = !prev
          try {
            sessionStorage.setItem(`${storageKey}__editing`, String(next))
          } catch {
            // ignore
          }
          return next
        })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lockEdits, storageKey])

  const clear = () => {
    setDataUrl(null)
    setError(null)
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
  }

  const handlePick = async (file: File | undefined) => {
    if (!file) return
    setError(null)

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }

    // Keep it reasonable for localStorage. ~2.5MB raw file is often already too big once base64 encoded.
    if (file.size > 1_500_000) {
      setError('Image is too large (max ~1.5MB). Please choose a smaller image.')
      return
    }

    try {
      const url = await readFileAsDataUrl(file)
      setDataUrl(url)
      localStorage.setItem(storageKey, url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load image.')
    }
  }

  return (
    <VStack align="center" spacing={2} w="100%" maxW="520px">
      {isEditing ? (
        <HStack spacing={2} justify="center" w="100%">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            void handlePick(e.target.files?.[0])
            // allow selecting the same file again later
            e.currentTarget.value = ''
          }}
        />

        <Button size="sm" variant={variant === 'logo' ? 'ghost' : 'outline'} onClick={() => inputRef.current?.click()}>
          {dataUrl ? 'Change Logo' : 'Add Logo'}
        </Button>

        {dataUrl ? (
          <IconButton
            aria-label="Remove header image"
            icon={<CloseIcon boxSize={3} />}
            size="sm"
            variant="ghost"
            onClick={clear}
          />
        ) : null}
        </HStack>
      ) : null}

      {dataUrl ? (
        <Box
          w="100%"
          display="flex"
          justifyContent="center"
          alignItems="center"
          overflow="hidden"
          borderRadius="lg"
          bg="transparent"
          border="0px solid"
          borderColor="transparent"
          px={0}
          py={0}
        >
          <Image
            src={dataUrl}
            alt="Header"
            maxH={`${maxHeightPx}px`}
            maxW="100%"
            objectFit="contain"
            borderRadius="md"
          />
        </Box>
      ) : (
        showLockedHint ? (
          <Text fontSize="xs" color="gray.500" textAlign="center">
            Logo is locked.
          </Text>
        ) : null
      )}

      {error ? (
        <Text fontSize="xs" color="red.500" textAlign="center">
          {error}
        </Text>
      ) : null}
    </VStack>
  )
}


