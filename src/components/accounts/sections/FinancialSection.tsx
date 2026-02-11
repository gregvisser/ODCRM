import { Badge, Text } from '@chakra-ui/react'
import { FieldGrid, FieldRow, NotSet } from '../FieldRow'

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }
  return null
}

const GBP = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})

function MoneyValue({ value }: { value: unknown }) {
  const n = toNumber(value)
  if (n === null) return <NotSet />
  return <Text fontSize="sm">{GBP.format(n)}</Text>
}

function IntValue({ value }: { value: unknown }) {
  const n = toNumber(value)
  if (n === null) return <NotSet />
  return <Text fontSize="sm">{Math.trunc(n)}</Text>
}

export function FinancialSection({
  monthlyIntakeGBP,
  monthlyRevenueFromCustomer,
  weeklyLeadTarget,
  weeklyLeadActual,
  monthlyLeadTarget,
  monthlyLeadActual,
  defcon,
}: {
  monthlyIntakeGBP: unknown
  monthlyRevenueFromCustomer: unknown
  weeklyLeadTarget: unknown
  weeklyLeadActual: unknown
  monthlyLeadTarget: unknown
  monthlyLeadActual: unknown
  defcon: unknown
}) {
  const defconNumber = toNumber(defcon)

  return (
    <FieldGrid>
      <FieldRow label="Monthly Intake GBP" value={<MoneyValue value={monthlyIntakeGBP} />} />
      <FieldRow label="Monthly Revenue from Customer" value={<MoneyValue value={monthlyRevenueFromCustomer} />} />

      <FieldRow label="Weekly Lead Target" value={<IntValue value={weeklyLeadTarget} />} />
      <FieldRow label="Weekly Lead Actual" value={<IntValue value={weeklyLeadActual} />} />

      <FieldRow label="Monthly Lead Target" value={<IntValue value={monthlyLeadTarget} />} />
      <FieldRow label="Monthly Lead Actual" value={<IntValue value={monthlyLeadActual} />} />

      <FieldRow
        label="Defcon"
        value={
          defconNumber === null ? (
            <NotSet />
          ) : (
            <Badge colorScheme={defconNumber >= 5 ? 'red' : defconNumber >= 3 ? 'orange' : 'green'}>
              {defconNumber}
            </Badge>
          )
        }
      />
    </FieldGrid>
  )
}

