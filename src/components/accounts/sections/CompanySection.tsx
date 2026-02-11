import { Box, GridItem, Link, Stack, Text } from '@chakra-ui/react'
import { FieldGrid, FieldRow, NotSet } from '../FieldRow'
import type { CustomerDetail } from '../types'
import { normalizeExternalHref } from '../url'

function TextValue({ value }: { value: string | null | undefined }) {
  const v = typeof value === 'string' ? value.trim() : ''
  if (!v) return <NotSet />
  return (
    <Text fontSize="sm" whiteSpace="pre-wrap">
      {v}
    </Text>
  )
}

export function CompanySection({ customer, headOfficeAddress }: { customer: CustomerDetail; headOfficeAddress?: string | null }) {
  const websiteHref = normalizeExternalHref(customer.website)
  const social = Array.isArray(customer.socialPresence) ? customer.socialPresence : []
  const headquarters = customer.headquarters || headOfficeAddress || null

  return (
    <FieldGrid>
      <FieldRow label="Customer Name" value={<Text fontSize="sm">{customer.name}</Text>} />
      <FieldRow label="Domain" value={<TextValue value={customer.domain} />} />

      <FieldRow
        label="Website"
        value={
          websiteHref ? (
            <Link href={websiteHref} isExternal fontSize="sm">
              {customer.website}
            </Link>
          ) : (
            <TextValue value={customer.website} />
          )
        }
      />
      <FieldRow label="Sector" value={<TextValue value={customer.sector} />} />

      <FieldRow label="Company Size" value={<TextValue value={customer.companySize} />} />
      <FieldRow label="Headquarters" value={<TextValue value={headquarters} />} />

      <FieldRow label="Founding Year" value={<TextValue value={customer.foundingYear} />} />

      <FieldRow
        label="Social Presence"
        value={
          social.length > 0 ? (
            <Stack spacing={1}>
              {social.map((p) => {
                const href = normalizeExternalHref(p?.url)
                const label = typeof p?.label === 'string' && p.label.trim() ? p.label.trim() : p?.url
                if (!href) {
                  return (
                    <Text key={`${label}-${p?.url}`} fontSize="sm" color="gray.700">
                      {label || 'Not set'}
                    </Text>
                  )
                }
                return (
                  <Link key={`${label}-${href}`} href={href} isExternal fontSize="sm">
                    {label}
                  </Link>
                )
              })}
            </Stack>
          ) : (
            <NotSet />
          )
        }
      />

      <GridItem colSpan={{ base: 1, md: 2 }}>
        <FieldRow label="Accreditations">
          <TextValue value={customer.accreditations} />
        </FieldRow>
      </GridItem>

      <GridItem colSpan={{ base: 1, md: 2 }}>
        <FieldRow label="Key Leaders">
          <TextValue value={customer.keyLeaders} />
        </FieldRow>
      </GridItem>

      <GridItem colSpan={{ base: 1, md: 2 }}>
        <FieldRow label="Company Profile">
          <TextValue value={customer.companyProfile} />
        </FieldRow>
      </GridItem>

      <GridItem colSpan={{ base: 1, md: 2 }}>
        <FieldRow label="Recent News">
          <TextValue value={customer.recentNews} />
        </FieldRow>
      </GridItem>

      {/* Spacer to keep consistent bottom rhythm */}
      <Box display={{ base: 'none', md: 'block' }} />
    </FieldGrid>
  )
}

