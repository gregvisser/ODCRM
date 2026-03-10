import { useEffect, useState } from 'react'
import { Badge, Box, Heading, HStack, Stack, Text } from '@chakra-ui/react'
import type { Account } from '../AccountsTab'

type CalendarEvent = {
  id: string
  title: string
  date: string
  time: string
  account?: string
  type: 'meeting' | 'call' | 'follow-up' | 'deadline'
}

type UpcomingEventsSectionProps = {
  account: Account
}

export default function UpcomingEventsSection({ account }: UpcomingEventsSectionProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])

  useEffect(() => {
    const today = new Date()
    const sampleEvents: CalendarEvent[] = [
      {
        id: '1',
        title: 'Quarterly Review Meeting',
        date: today.toISOString().split('T')[0],
        time: '10:00',
        account: account.name,
        type: 'meeting',
      },
      {
        id: '2',
        title: 'Follow-up Call',
        date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: '14:30',
        account: account.name,
        type: 'call',
      },
      {
        id: '3',
        title: 'Contract Renewal Deadline',
        date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: '17:00',
        account: account.name,
        type: 'deadline',
      },
    ]
    setEvents(sampleEvents)
  }, [account.name])

  const getEventTypeColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'meeting':
        return 'blue'
      case 'call':
        return 'green'
      case 'follow-up':
        return 'orange'
      case 'deadline':
        return 'red'
      default:
        return 'gray'
    }
  }

  return (
    <Box
      p={4}
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      bg="white"
    >
      <Heading size="sm" mb={3}>
        Upcoming Events
      </Heading>
      {events.length === 0 ? (
        <Text fontSize="sm" color="gray.500" fontStyle="italic">
          No upcoming events. Events will sync from Outlook calendar.
        </Text>
      ) : (
        <Stack spacing={2}>
          {events
            .sort((a, b) => {
              const dateA = new Date(`${a.date}T${a.time}`)
              const dateB = new Date(`${b.date}T${b.time}`)
              return dateA.getTime() - dateB.getTime()
            })
            .map((event) => (
              <HStack
                key={event.id}
                p={2}
                border="1px solid"
                borderColor="gray.200"
                borderRadius="md"
                _hover={{ bg: 'gray.50' }}
              >
                <Box
                  w={2}
                  h={8}
                  bg={`${getEventTypeColor(event.type)}.400`}
                  borderRadius="sm"
                />
                <Stack spacing={0} flex={1}>
                  <Text fontSize="sm" fontWeight="medium">
                    {event.title}
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    {new Date(event.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    at {event.time}
                  </Text>
                </Stack>
                <Badge colorScheme={getEventTypeColor(event.type)} size="sm">
                  {event.type}
                </Badge>
              </HStack>
            ))}
        </Stack>
      )}
    </Box>
  )
}
