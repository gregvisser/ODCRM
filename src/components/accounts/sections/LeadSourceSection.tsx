import { Link, Text } from '@chakra-ui/react'
import { FieldGrid, FieldRow, NotSet } from '../FieldRow'
import { normalizeExternalHref } from '../url'

function TextValue({ value }: { value: string | null | undefined }) {
  const v = typeof value === 'string' ? value.trim() : ''
  if (!v) return <NotSet />
  return <Text fontSize="sm">{v}</Text>
}

export function LeadSourceSection({
  leadsGoogleSheetUrl,
  leadsGoogleSheetLabel,
  leadsReportingUrl,
}: {
  leadsGoogleSheetUrl: string | null | undefined
  leadsGoogleSheetLabel: string | null | undefined
  leadsReportingUrl: string | null | undefined
}) {
  const sheetHref = normalizeExternalHref(leadsGoogleSheetUrl)
  const label = typeof leadsGoogleSheetLabel === 'string' && leadsGoogleSheetLabel.trim() ? leadsGoogleSheetLabel.trim() : null

  const reportingHref = normalizeExternalHref(leadsReportingUrl)

  return (
    <FieldGrid>
      <FieldRow
        label="Leads Google Sheet URL"
        value={
          sheetHref ? (
            <Link href={sheetHref} isExternal fontSize="sm">
              {label || leadsGoogleSheetUrl}
            </Link>
          ) : (
            <TextValue value={leadsGoogleSheetUrl} />
          )
        }
      />
      <FieldRow label="Leads Google Sheet Label" value={<TextValue value={leadsGoogleSheetLabel} />} />

      <FieldRow
        label="Leads Reporting URL"
        value={
          reportingHref ? (
            <Link href={reportingHref} isExternal fontSize="sm">
              {leadsReportingUrl}
            </Link>
          ) : (
            <TextValue value={leadsReportingUrl} />
          )
        }
      />
    </FieldGrid>
  )
}

