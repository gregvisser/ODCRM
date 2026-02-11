import { Badge, Button, HStack, Text } from '@chakra-ui/react'
import { FieldGrid, FieldRow, NotSet } from '../FieldRow'
import type { AssignedAccountManagerUser } from '../types'

export function OwnershipSection({
  assignedAccountManagerUser,
  assignedClientDdiNumber,
  daysPerWeek,
  onOpenManager,
}: {
  assignedAccountManagerUser?: AssignedAccountManagerUser
  assignedClientDdiNumber?: string | null
  daysPerWeek?: number | null
  onOpenManager?: () => void
}) {
  const managerName = assignedAccountManagerUser
    ? `${assignedAccountManagerUser.firstName} ${assignedAccountManagerUser.lastName}`.trim() || assignedAccountManagerUser.email
    : ''

  return (
    <FieldGrid>
      <FieldRow
        label="Assigned Account Manager"
        value={
          assignedAccountManagerUser ? (
            <HStack spacing={2} flexWrap="wrap">
              <Button size="sm" variant="link" onClick={onOpenManager}>
                {managerName}
              </Button>
              <Badge colorScheme="purple">{assignedAccountManagerUser.role}</Badge>
            </HStack>
          ) : (
            <NotSet />
          )
        }
      />

      <FieldRow
        label="Assigned Client DDI & Number"
        value={
          assignedClientDdiNumber && assignedClientDdiNumber.trim() ? (
            <Text fontSize="sm">{assignedClientDdiNumber}</Text>
          ) : (
            <NotSet />
          )
        }
      />

      <FieldRow
        label="Days a Week"
        value={typeof daysPerWeek === 'number' && Number.isFinite(daysPerWeek) ? <Text fontSize="sm">{daysPerWeek}</Text> : <NotSet />}
      />
    </FieldGrid>
  )
}

