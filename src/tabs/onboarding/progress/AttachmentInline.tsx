import { Badge, Button, HStack, Input, Stack, Text, useToast, Wrap, WrapItem } from '@chakra-ui/react'
import { AttachmentIcon } from '@chakra-ui/icons'
import { emit } from '../../../platform/events'

export function AttachmentInline({
  customerId,
  attachmentType,
  busyKey,
  setBusyKey,
  onDone,
  files,
}: {
  customerId: string
  attachmentType: string
  busyKey: string | null
  setBusyKey: (s: string | null) => void
  onDone: () => void
  files: string[]
}) {
  const toast = useToast()
  const upload = (file: File) => {
    const token = `upload-${attachmentType}`
    setBusyKey(token)
    void (async () => {
      try {
        const fd = new FormData()
        fd.append('file', file, file.name)
        fd.append('attachmentType', attachmentType)
        const r = await fetch(`/api/customers/${customerId}/attachments`, { method: 'POST', body: fd })
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || r.statusText)
        onDone()
        emit('customerUpdated', { id: customerId })
        toast({ title: 'Uploaded', status: 'success', duration: 2500 })
      } catch (e) {
        toast({ title: 'Upload failed', description: e instanceof Error ? e.message : 'Error', status: 'error' })
      } finally {
        setBusyKey(null)
      }
    })()
  }

  return (
    <Stack spacing={1} mt={1}>
      <Button
        as="label"
        size="xs"
        leftIcon={<AttachmentIcon />}
        variant="outline"
        isLoading={busyKey === `upload-${attachmentType}`}
        cursor="pointer"
      >
        Add file
        <Input
          type="file"
          display="none"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
            e.target.value = ''
          }}
        />
      </Button>
      {files.length > 0 ? (
        <Wrap>
          {files.map((f) => (
            <WrapItem key={f}>
              <Badge colorScheme="purple">{f}</Badge>
            </WrapItem>
          ))}
        </Wrap>
      ) : (
        <Text fontSize="xs" color="gray.500">
          No files yet
        </Text>
      )}
    </Stack>
  )
}
