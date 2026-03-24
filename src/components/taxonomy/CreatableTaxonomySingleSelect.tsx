import { CheckIcon, CloseIcon } from '@chakra-ui/icons'
import { Box, Button, HStack, IconButton, Input, Stack, Tag, TagLabel, Text, VStack } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { normalizeTaxonomyLabel } from '../../utils/taxonomyLabel'

export type TaxonomyRow = { id: string; label: string }

type Props = {
  fieldLabel: string
  items: TaxonomyRow[]
  /** Selected option id, or empty when only legacy free-text / unmatched */
  valueId: string
  valueLabel: string
  onChange: (next: { id: string; label: string } | null) => void
  createItem: (raw: string) => Promise<TaxonomyRow | null>
  placeholder?: string
}

/**
 * Single-value creatable selector. Downstream contract stays one role: one id + display label.
 */
export function CreatableTaxonomySingleSelect({
  fieldLabel: _fieldLabel,
  items,
  valueId,
  valueLabel,
  onChange,
  createItem,
  placeholder = 'Search or add…',
}: Props) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)

  const display = valueId
    ? items.find((i) => i.id === valueId)?.label || valueLabel
    : valueLabel

  const q = normalizeTaxonomyLabel(input)
  const filtered = useMemo(() => {
    if (!q) return items.slice(0, 30)
    const ql = q.toLowerCase()
    return items.filter((i) => i.label.toLowerCase().includes(ql)).slice(0, 30)
  }, [items, q])

  const apply = async (raw?: string) => {
    const source = raw !== undefined ? raw : input
    const n = normalizeTaxonomyLabel(source)
    if (!n) return
    const existing = items.find((i) => i.label.toLowerCase() === n.toLowerCase())
    const row = existing ?? (await createItem(n))
    if (!row) return
    onChange({ id: row.id, label: row.label })
    setInput('')
    setOpen(false)
  }

  return (
    <Stack spacing={2}>
      {valueId || valueLabel ? (
        <HStack>
          <Tag size="md" colorScheme="cyan" borderRadius="full" maxW="100%">
            <TagLabel noOfLines={1}>{display || '—'}</TagLabel>
          </Tag>
          <IconButton
            size="xs"
            variant="ghost"
            aria-label="Clear role"
            icon={<CloseIcon />}
            onClick={() => {
              onChange(null)
              setInput('')
            }}
          />
        </HStack>
      ) : null}
      <HStack align="flex-start">
        <Box position="relative" flex="1" minW={0}>
          <Input
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 180)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void apply()
              }
            }}
            placeholder={placeholder}
          />
          {open && filtered.length > 0 ? (
            <Box
              position="absolute"
              left={0}
              right={0}
              top="100%"
              mt={1}
              zIndex={20}
              borderWidth="1px"
              borderRadius="md"
              borderColor="gray.200"
              bg="white"
              boxShadow="md"
              maxH="220px"
              overflowY="auto"
            >
              <VStack align="stretch" spacing={0}>
                {filtered.map((opt) => (
                  <Button
                    key={opt.id}
                    variant="ghost"
                    justifyContent="space-between"
                    fontWeight="normal"
                    borderRadius={0}
                    w="100%"
                    px={3}
                    py={2}
                    h="auto"
                    fontSize="sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void apply(opt.label)}
                  >
                    <Text noOfLines={1} textAlign="left" flex={1}>
                      {opt.label}
                    </Text>
                    {valueId === opt.id ? <CheckIcon boxSize={3} color="teal.500" /> : null}
                  </Button>
                ))}
              </VStack>
            </Box>
          ) : null}
        </Box>
      </HStack>
    </Stack>
  )
}
