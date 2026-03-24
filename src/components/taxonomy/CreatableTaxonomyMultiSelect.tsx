import { AddIcon } from '@chakra-ui/icons'
import { Box, Button, HStack, IconButton, Input, Stack, Tag, TagCloseButton, TagLabel, Text, VStack } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { normalizeTaxonomyLabel } from '../../utils/taxonomyLabel'

export type TaxonomyRow = { id: string; label: string }

type Props = {
  /** Field label (accessibility / future) */
  fieldLabel: string
  items: TaxonomyRow[]
  selectedIds: string[]
  onChangeSelectedIds: (ids: string[]) => void
  createItem: (raw: string) => Promise<TaxonomyRow | null>
  placeholder?: string
  addButtonAriaLabel?: string
  /** Chakra colorScheme for selected tags (default blue) */
  tagColorScheme?: string
}

export function CreatableTaxonomyMultiSelect({
  fieldLabel: _fieldLabel,
  items,
  selectedIds,
  onChangeSelectedIds,
  createItem,
  placeholder = 'Search or add…',
  addButtonAriaLabel = 'Add',
  tagColorScheme = 'blue',
}: Props) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)

  const q = normalizeTaxonomyLabel(input)
  const filtered = useMemo(() => {
    if (!q) return items.slice(0, 30)
    const ql = q.toLowerCase()
    return items.filter((i) => i.label.toLowerCase().includes(ql)).slice(0, 30)
  }, [items, q])

  const resolveLabel = (id: string) => items.find((i) => i.id === id)?.label || id

  const pickOrCreate = async (rawLabel?: string) => {
    const source = rawLabel !== undefined ? rawLabel : input
    const n = normalizeTaxonomyLabel(source)
    if (!n) return
    const existing = items.find((i) => i.label.toLowerCase() === n.toLowerCase())
    const row = existing ?? (await createItem(n))
    if (!row) return
    if (!selectedIds.includes(row.id)) onChangeSelectedIds([...selectedIds, row.id])
    setInput('')
    setOpen(false)
  }

  return (
    <Stack spacing={2}>
      <HStack align="flex-start">
        <Box position="relative" flex="1" minW={0}>
          <Input
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 180)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void pickOrCreate()
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
                    justifyContent="flex-start"
                    fontWeight="normal"
                    borderRadius={0}
                    px={3}
                    py={2}
                    h="auto"
                    fontSize="sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void pickOrCreate(opt.label)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </VStack>
            </Box>
          ) : null}
        </Box>
        <IconButton
          aria-label={addButtonAriaLabel}
          icon={<AddIcon />}
          onClick={() => void pickOrCreate()}
        />
      </HStack>
      <HStack spacing={2} flexWrap="wrap">
        {selectedIds.length === 0 ? (
          <Text fontSize="sm" color="gray.500">
            None selected
          </Text>
        ) : (
          selectedIds.map((id) => (
            <Tag key={id} size="sm" colorScheme={tagColorScheme} borderRadius="full">
              <TagLabel>{resolveLabel(id)}</TagLabel>
              <TagCloseButton
                onClick={() => onChangeSelectedIds(selectedIds.filter((x) => x !== id))}
              />
            </Tag>
          ))
        )}
      </HStack>
    </Stack>
  )
}
