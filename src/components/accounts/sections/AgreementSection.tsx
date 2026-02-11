import { Link, Text } from '@chakra-ui/react'
import { FieldGrid, FieldRow, NotSet } from '../FieldRow'

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('en-GB', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function AgreementSection({
  customerId,
  agreementFileName,
  uploadedAt,
  uploadedBy,
}: {
  customerId: string
  agreementFileName: string | null | undefined
  uploadedAt: string | null | undefined
  uploadedBy: string | null | undefined
}) {
  const apiBase = import.meta.env.VITE_API_URL || ''
  const downloadHref = `${apiBase}/api/customers/${customerId}/agreement-download`

  const uploadedAtLabel = formatDateTime(uploadedAt)

  return (
    <FieldGrid>
      <FieldRow
        label="Agreement File Name"
        value={
          agreementFileName ? (
            <Link href={downloadHref} isExternal fontSize="sm">
              {agreementFileName}
            </Link>
          ) : (
            <Text fontSize="sm" color="gray.500">
              No agreement uploaded
            </Text>
          )
        }
      />
      <FieldRow label="Uploaded At" value={uploadedAtLabel ? <Text fontSize="sm">{uploadedAtLabel}</Text> : <NotSet />} />
      <FieldRow label="Uploaded By" value={uploadedBy ? <Text fontSize="sm">{uploadedBy}</Text> : <NotSet />} />
    </FieldGrid>
  )
}

