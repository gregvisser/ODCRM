import { useEffect, useState, type ReactNode } from 'react'
import { CheckIcon, CloseIcon } from '@chakra-ui/icons'
import { Box, Button, HStack, Input, Select, Stack, Text } from '@chakra-ui/react'
import FieldRow from './FieldRow'

type EditableFieldProps = {
  value: string | number
  onSave: (value: string | number) => void | Promise<void>
  onCancel: () => void
  isEditing: boolean
  onEdit: () => void
  label: string
  type?: 'text' | 'number' | 'textarea' | 'date' | 'url' | 'select'
  placeholder?: string
  renderDisplay?: (value: string | number) => ReactNode
  options?: Array<{ value: string; label: string }>
}

export default function EditableField({
  value,
  onSave,
  onCancel,
  isEditing,
  onEdit,
  label,
  type = 'text',
  placeholder,
  renderDisplay,
  options,
}: EditableFieldProps) {
  const [editValue, setEditValue] = useState<string>(String(value))
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setEditValue(String(value))
  }, [value, isEditing])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      if (type === 'number') {
        const n = Number(editValue)
        await onSave(Number.isFinite(n) ? n : 0)
      } else {
        await onSave(editValue)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(String(value))
    onCancel()
  }

  if (!isEditing) {
    return (
      <FieldRow label={label} editable onEdit={onEdit}>
        <HStack spacing={2} align="center">
          <Box flex="1">
            {renderDisplay ? renderDisplay(value) : <Text>{value || placeholder || 'Not set'}</Text>}
          </Box>
        </HStack>
      </FieldRow>
    )
  }

  return (
    <FieldRow label={label} isEditing={isEditing}>
      <Stack spacing={2}>
        {type === 'textarea' ? (
          <Box
            as="textarea"
            value={editValue}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditValue(e.target.value)}
            placeholder={placeholder}
            rows={4}
            p={2}
            border="1px solid"
            borderColor="gray.300"
            borderRadius="md"
            fontSize="sm"
            resize="vertical"
          />
        ) : type === 'date' ? (
          <Input
            type="date"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            size="sm"
          />
        ) : type === 'url' ? (
          <Input
            type="url"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            size="sm"
          />
        ) : type === 'select' ? (
          <Select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            size="sm"
          >
            {(options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            size="sm"
          />
        )}
        <HStack spacing={2}>
          <Button
            size="xs"
            colorScheme="gray"
            leftIcon={<CheckIcon />}
            onClick={() => void handleSave()}
            isLoading={isSaving}
          >
            Save
          </Button>
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<CloseIcon />}
            onClick={handleCancel}
            isDisabled={isSaving}
          >
            Cancel
          </Button>
        </HStack>
      </Stack>
    </FieldRow>
  )
}
