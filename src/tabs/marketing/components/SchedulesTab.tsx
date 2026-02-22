import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  MenuDivider,
  Select,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
  Badge,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Textarea,
  Spacer,
  Divider,
  useToast,
  Tag,
  TagLabel,
  Switch,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Checkbox,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import {
  AddIcon,
  EditIcon,
  DeleteIcon,
  TimeIcon,
  CalendarIcon,
  SettingsIcon,
  CheckIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'

type CampaignSchedule = {
  id: string
  customerId: string
  name: string
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'sent'
  senderIdentity: {
    id: string
    emailAddress: string
    displayName?: string | null
    dailySendLimit: number
    sendWindowHoursStart: number
    sendWindowHoursEnd: number
    sendWindowTimeZone: string
  } | null
  totalProspects: number
  createdAt: string
  updatedAt: string
}

type TimeWindow = {
  startTime: string
  endTime: string
  maxEmails: number
}

// DeliverySchedule extends CampaignSchedule with UI-only scheduling fields
// (these fields are stored in the sender identity / not yet in DB, so they default gracefully)
type DeliverySchedule = CampaignSchedule & {
  description?: string
  isActive: boolean
  timezone: string
  daysOfWeek: number[]
  timeWindows: TimeWindow[]
  maxEmailsPerDay?: number
  maxEmailsPerHour?: number
  respectRecipientTimezone?: boolean
}

type ScheduledEmail = {
  id: string
  campaignId: string
  campaignName: string
  prospectEmail: string
  prospectName: string
  scheduledFor: string
  status: 'scheduled' | 'sent' | 'failed'
  senderIdentity?: {
    id: string
    emailAddress: string
    displayName?: string | null
  } | null
  stepNumber: number
}

type ScheduleStats = {
  campaignId: string
  status: string
  totalProspects: number
  upcomingSends: number
  sentSends: number
  todaySent: number
  dailyLimit: number
  senderIdentity: {
    id: string
    emailAddress: string
    dailySendLimit: number
  } | null
}

const SchedulesTab: React.FC = () => {
  const [schedules, setSchedules] = useState<CampaignSchedule[]>([])
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([])
  const [loading, setLoading] = useState(true)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [editingSchedule, setEditingSchedule] = useState<DeliverySchedule | null>(null)
  const [scheduleStats, setScheduleStats] = useState<ScheduleStats | null>(null)
  const toast = useToast()

  const daysOfWeek = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ]

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [schedulesRes, emailsRes] = await Promise.all([
        api.get<CampaignSchedule[]>('/api/schedules'),
        api.get<ScheduledEmail[]>('/api/schedules/emails')
      ])

      if (schedulesRes.error) {
        console.error('Failed to load schedules:', schedulesRes.error)
        setSchedules([])
      } else {
        setSchedules(schedulesRes.data || [])
      }

      if (emailsRes.error) {
        console.error('Failed to load scheduled emails:', emailsRes.error)
        setScheduledEmails([])
      } else {
        setScheduledEmails(emailsRes.data || [])
      }
    } catch (error) {
      console.error('Error loading schedules:', error)
      setSchedules([])
      setScheduledEmails([])
    } finally {
      setLoading(false)
    }
  }

  const loadScheduleStats = async (scheduleId: string) => {
    try {
      const statsRes = await api.get<ScheduleStats>(`/api/schedules/${scheduleId}/stats`)
      if (statsRes.error) {
        console.error('Failed to load schedule stats:', statsRes.error)
      } else {
        setScheduleStats(statsRes.data || null)
      }
    } catch (error) {
      console.error('Error loading schedule stats:', error)
    }
  }

  const handlePauseSchedule = async (scheduleId: string) => {
    try {
      const res = await api.post(`/api/schedules/${scheduleId}/pause`, {})
      if (res.error) {
        toast({
          title: 'Failed to pause schedule',
          description: res.error,
          status: 'error',
          duration: 3000,
        })
      } else {
        toast({
          title: 'Schedule paused',
          description: 'The campaign has been paused',
          status: 'success',
          duration: 3000,
        })
        loadData() // Refresh the list
      }
    } catch (error) {
      console.error('Error pausing schedule:', error)
      toast({
        title: 'Error',
        description: 'Failed to pause schedule',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleResumeSchedule = async (scheduleId: string) => {
    try {
      const res = await api.post(`/api/schedules/${scheduleId}/resume`, {})
      if (res.error) {
        toast({
          title: 'Failed to resume schedule',
          description: res.error,
          status: 'error',
          duration: 3000,
        })
      } else {
        toast({
          title: 'Schedule resumed',
          description: 'The campaign has been resumed',
          status: 'success',
          duration: 3000,
        })
        loadData() // Refresh the list
      }
    } catch (error) {
      console.error('Error resuming schedule:', error)
      toast({
        title: 'Error',
        description: 'Failed to resume schedule',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const stats = useMemo(() => {
    const now = new Date()
    const today = now.toDateString()
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toDateString()

    return {
      totalSchedules: schedules.length,
      activeSchedules: schedules.filter((s) => s.status === 'running').length,
      todayScheduled: scheduledEmails.filter(
        (e) => new Date(e.scheduledFor).toDateString() === today,
      ).length,
      thisWeekScheduled: scheduledEmails.filter(
        (e) => new Date(e.scheduledFor).toDateString() <= weekLater,
      ).length,
      pendingEmails: scheduledEmails.filter((e) => e.status === 'scheduled').length,
    }
  }, [schedules, scheduledEmails])

  const handleCreateSchedule = () => {
    setEditingSchedule({
      id: '',
      customerId: '',
      name: '',
      status: 'draft',
      senderIdentity: null,
      totalProspects: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      description: '',
      isActive: true,
      timezone: 'Europe/London',
      daysOfWeek: [1, 2, 3, 4, 5],
      timeWindows: [{ startTime: '09:00', endTime: '17:00', maxEmails: 50 }],
      maxEmailsPerDay: 200,
      maxEmailsPerHour: 10,
      respectRecipientTimezone: true,
    })
    onOpen()
  }

  const handleEditSchedule = (schedule: CampaignSchedule) => {
    setEditingSchedule({
      ...schedule,
      isActive: schedule.status === 'running',
      timezone: schedule.senderIdentity?.sendWindowTimeZone ?? 'Europe/London',
      daysOfWeek: [1, 2, 3, 4, 5],
      timeWindows: [
        {
          startTime: `${String(schedule.senderIdentity?.sendWindowHoursStart ?? 9).padStart(2, '0')}:00`,
          endTime: `${String(schedule.senderIdentity?.sendWindowHoursEnd ?? 17).padStart(2, '0')}:00`,
          maxEmails: schedule.senderIdentity?.dailySendLimit ?? 50,
        },
      ],
    })
    onOpen()
  }

  const handleSaveSchedule = async () => {
    if (!editingSchedule) return

    try {
      if (editingSchedule.id) {
        await api.put(`/api/schedules/${editingSchedule.id}`, editingSchedule)
      } else {
        const res = await api.post('/api/schedules', editingSchedule)
        setEditingSchedule({ ...editingSchedule, id: (res.data as any).id })
      }
      await loadData()
      onClose()
      toast({
        title: `Schedule ${editingSchedule.id ? 'updated' : 'created'}`,
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: `Failed to ${editingSchedule.id ? 'update' : 'create'} schedule`,
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleToggleSchedule = async (schedule: CampaignSchedule) => {
    const nowActive = schedule.status !== 'running'
    try {
      await api.patch(`/api/schedules/${schedule.id}`, { isActive: nowActive })
      await loadData()
      toast({
        title: `Schedule ${nowActive ? 'activated' : 'deactivated'}`,
        status: 'success',
        duration: 2000,
      })
    } catch (error) {
      toast({
        title: 'Failed to update schedule',
        status: 'error',
        duration: 2000,
      })
    }
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await api.delete(`/api/schedules/${scheduleId}`)
      await loadData()
      toast({
        title: 'Schedule deleted',
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Failed to delete schedule',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleAddTimeWindow = () => {
    if (!editingSchedule) return
    setEditingSchedule({
      ...editingSchedule,
      timeWindows: [
        ...editingSchedule.timeWindows,
        { startTime: '09:00', endTime: '17:00', maxEmails: 50 }
      ]
    })
  }

  const handleUpdateTimeWindow = (index: number, field: keyof TimeWindow, value: string | number) => {
    if (!editingSchedule) return
    const newWindows = [...editingSchedule.timeWindows]
    newWindows[index] = { ...newWindows[index], [field]: value }
    setEditingSchedule({
      ...editingSchedule,
      timeWindows: newWindows
    })
  }

  const handleRemoveTimeWindow = (index: number) => {
    if (!editingSchedule) return
    setEditingSchedule({
      ...editingSchedule,
      timeWindows: editingSchedule.timeWindows.filter((_, i) => i !== index)
    })
  }

  const formatTimeWindows = (windows: TimeWindow[]) => {
    return windows.map(w => `${w.startTime}-${w.endTime}`).join(', ')
  }

  const formatDaysOfWeek = (days: number[]) => {
    return days.map(d => daysOfWeek[d].label.slice(0, 3)).join(', ')
  }

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Text>Loading schedules...</Text>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">Schedules</Heading>
          <Text color="gray.600">
            View and manage active campaign schedules with upcoming sends
          </Text>
        </VStack>
      </Flex>

      {/* Stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Active Campaigns</StatLabel>
              <StatNumber>{schedules.filter(s => s.status === 'running').length}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Paused Campaigns</StatLabel>
              <StatNumber>{schedules.filter(s => s.status === 'paused').length}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Upcoming Sends</StatLabel>
              <StatNumber>{scheduledEmails.length}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Prospects</StatLabel>
              <StatNumber>{schedules.reduce((sum, s) => sum + s.totalProspects, 0)}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>This Week</StatLabel>
              <StatNumber>{stats.thisWeekScheduled}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
        {/* Schedules List */}
        <Card>
          <CardHeader>
            <Heading size="md">Delivery Schedules</Heading>
          </CardHeader>
          <CardBody p={0}>
            <VStack spacing={0} align="stretch">
              {schedules.map((schedule) => (
                <Box
                  key={schedule.id}
                  p={4}
                  borderBottom="1px solid"
                  borderColor="gray.100"
                  _last={{ borderBottom: 'none' }}
                >
                  <Flex justify="space-between" align="start" mb={3}>
                    <VStack align="start" spacing={1}>
                      <HStack>
                        <Heading size="md">{schedule.name}</Heading>
                        <Badge colorScheme={schedule.isActive ? 'green' : 'gray'}>
                          {schedule.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </HStack>
                      {schedule.description && (
                        <Text fontSize="sm" color="gray.600">{schedule.description}</Text>
                      )}
                    </VStack>
                    <Menu>
                      <MenuButton
                        as={IconButton}
                        icon={<SettingsIcon />}
                        size="sm"
                        variant="ghost"
                      />
                      <MenuList>
                        <MenuItem icon={<EditIcon />} onClick={() => handleEditSchedule(schedule)}>
                          Edit
                        </MenuItem>
                        <MenuItem
                          as={Switch}
                          isChecked={schedule.isActive}
                          onChange={() => handleToggleSchedule(schedule)}
                        >
                          {schedule.isActive ? 'Deactivate' : 'Activate'}
                        </MenuItem>
                        <MenuDivider />
                        <MenuItem icon={<DeleteIcon />} color="red.500" onClick={() => handleDeleteSchedule(schedule.id)}>
                          Delete
                        </MenuItem>
                      </MenuList>
                    </Menu>
                  </Flex>

                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Box>
                      <Text fontSize="sm" fontWeight="semibold" mb={1}>Days & Times</Text>
                      <HStack spacing={4}>
                        <VStack align="start" spacing={0}>
                          <Text fontSize="xs" color="gray.600">Days</Text>
                          <Text fontSize="sm">{formatDaysOfWeek(schedule.daysOfWeek)}</Text>
                        </VStack>
                        <VStack align="start" spacing={0}>
                          <Text fontSize="xs" color="gray.600">Hours</Text>
                          <Text fontSize="sm">{formatTimeWindows(schedule.timeWindows)}</Text>
                        </VStack>
                      </HStack>
                    </Box>

                    <Box>
                      <Text fontSize="sm" fontWeight="semibold" mb={1}>Limits</Text>
                      <HStack spacing={4}>
                        <VStack align="start" spacing={0}>
                          <Text fontSize="xs" color="gray.600">Per Day</Text>
                          <Text fontSize="sm">{schedule.maxEmailsPerDay}</Text>
                        </VStack>
                        <VStack align="start" spacing={0}>
                          <Text fontSize="xs" color="gray.600">Per Hour</Text>
                          <Text fontSize="sm">{schedule.maxEmailsPerHour}</Text>
                        </VStack>
                      </HStack>
                    </Box>
                  </SimpleGrid>

                  <HStack spacing={2} mt={3}>
                    {schedule.respectRecipientTimezone && (
                      <Tag size="sm" colorScheme="blue">
                        <TagLabel>Respects Timezone</TagLabel>
                      </Tag>
                    )}
                    <Text fontSize="xs" color="gray.600">
                      Updated {new Date(schedule.updatedAt).toLocaleDateString()}
                    </Text>
                  </HStack>
                </Box>
              ))}
            </VStack>
          </CardBody>
        </Card>

        {/* Upcoming Emails */}
        <Card>
          <CardHeader>
            <Heading size="md">Upcoming Emails</Heading>
          </CardHeader>
          <CardBody p={0}>
            <Box overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Time</Th>
                    <Th>Campaign</Th>
                    <Th>Recipient</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {scheduledEmails.slice(0, 10).map((email) => (
                    <Tr key={email.id}>
                      <Td>
                        <VStack align="start" spacing={0}>
                          <Text fontSize="sm" fontWeight="semibold">
                            {new Date(email.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Text fontSize="xs" color="gray.600">
                            {new Date(email.scheduledFor).toLocaleDateString()}
                          </Text>
                        </VStack>
                      </Td>
                      <Td>
                        <Text fontSize="sm" noOfLines={2}>
                          {email.campaignName}
                        </Text>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={0}>
                          <Text fontSize="sm" fontWeight="semibold">
                            {email.prospectName}
                          </Text>
                          <Text fontSize="xs" color="gray.600">
                            {email.prospectEmail}
                          </Text>
                        </VStack>
                      </Td>
                      <Td>
                        <Badge
                          size="sm"
                          colorScheme={
                            email.status === 'sent' ? 'green' :
                            email.status === 'failed' ? 'red' : 'blue'
                          }
                        >
                          {email.status}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </CardBody>
        </Card>
      </Grid>

      {/* Create/Edit Schedule Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="4xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingSchedule?.id ? 'Edit Schedule' : 'Create Schedule'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {editingSchedule && (
              <VStack spacing={4} align="stretch">
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Schedule Name</FormLabel>
                    <Input
                      value={editingSchedule.name}
                      onChange={(e) => setEditingSchedule({...editingSchedule, name: e.target.value})}
                      placeholder="e.g., Business Hours - EST"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Timezone</FormLabel>
                    <Select
                      value={editingSchedule.timezone}
                      onChange={(e) => setEditingSchedule({...editingSchedule, timezone: e.target.value})}
                    >
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="UTC">UTC</option>
                    </Select>
                  </FormControl>
                </SimpleGrid>

                <FormControl>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    value={editingSchedule.description || ''}
                    onChange={(e) => setEditingSchedule({...editingSchedule, description: e.target.value})}
                    placeholder="Describe this delivery schedule..."
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Days of Week</FormLabel>
                  <SimpleGrid columns={7} spacing={2}>
                    {daysOfWeek.map((day) => (
                      <Checkbox
                        key={day.value}
                        isChecked={editingSchedule.daysOfWeek.includes(day.value)}
                        onChange={(e) => {
                          const newDays = e.target.checked
                            ? [...editingSchedule.daysOfWeek, day.value]
                            : editingSchedule.daysOfWeek.filter(d => d !== day.value)
                          setEditingSchedule({...editingSchedule, daysOfWeek: newDays})
                        }}
                      >
                        {day.label.slice(0, 3)}
                      </Checkbox>
                    ))}
                  </SimpleGrid>
                </FormControl>

                <FormControl>
                  <Flex justify="space-between" align="center" mb={2}>
                    <FormLabel mb={0}>Time Windows</FormLabel>
                    <Button size="sm" leftIcon={<AddIcon />} onClick={handleAddTimeWindow}>
                      Add Window
                    </Button>
                  </Flex>
                  <VStack spacing={3} align="stretch">
                    {editingSchedule.timeWindows.map((window, index) => (
                      <Flex key={index} gap={4} align="center">
                        <Input
                          type="time"
                          value={window.startTime}
                          onChange={(e) => handleUpdateTimeWindow(index, 'startTime', e.target.value)}
                          size="sm"
                          w="120px"
                        />
                        <Text fontSize="sm">to</Text>
                        <Input
                          type="time"
                          value={window.endTime}
                          onChange={(e) => handleUpdateTimeWindow(index, 'endTime', e.target.value)}
                          size="sm"
                          w="120px"
                        />
                        <NumberInput
                          value={window.maxEmails}
                          onChange={(_, value) => handleUpdateTimeWindow(index, 'maxEmails', value)}
                          size="sm"
                          w="120px"
                          min={1}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <Text fontSize="sm">emails</Text>
                        <IconButton
                          size="sm"
                          icon={<DeleteIcon />}
                          colorScheme="red"
                          variant="ghost"
                          onClick={() => handleRemoveTimeWindow(index)}
                          isDisabled={editingSchedule.timeWindows.length === 1}
                          aria-label="Remove time window"
                        />
                      </Flex>
                    ))}
                  </VStack>
                </FormControl>

                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Max Emails Per Day</FormLabel>
                    <NumberInput
                      value={editingSchedule.maxEmailsPerDay}
                      onChange={(_, value) => setEditingSchedule({...editingSchedule, maxEmailsPerDay: value})}
                      min={1}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Max Emails Per Hour</FormLabel>
                    <NumberInput
                      value={editingSchedule.maxEmailsPerHour}
                      onChange={(_, value) => setEditingSchedule({...editingSchedule, maxEmailsPerHour: value})}
                      min={1}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Respect Recipient Timezone</FormLabel>
                    <Switch
                      isChecked={editingSchedule.respectRecipientTimezone}
                      onChange={(e) => setEditingSchedule({...editingSchedule, respectRecipientTimezone: e.target.checked})}
                    />
                  </FormControl>
                </SimpleGrid>
              </VStack>
            )}
          </ModalBody>
          <Flex justify="flex-end" p={6} pt={0}>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSaveSchedule}>
              {editingSchedule?.id ? 'Save Changes' : 'Create Schedule'}
            </Button>
          </Flex>
        </ModalContent>
      </Modal>
    </Box>
  )
}

// Mock data — kept for reference only, not used at runtime
const _mockSchedules: DeliverySchedule[] = [
  {
    id: '1',
    customerId: '',
    name: 'Business Hours - UK',
    status: 'running',
    senderIdentity: null,
    totalProspects: 0,
    description: 'Standard business hours for UK prospects',
    isActive: true,
    timezone: 'Europe/London',
    daysOfWeek: [1, 2, 3, 4, 5],
    timeWindows: [
      { startTime: '09:00', endTime: '12:00', maxEmails: 50 },
      { startTime: '13:00', endTime: '17:00', maxEmails: 50 },
    ],
    maxEmailsPerDay: 200,
    maxEmailsPerHour: 10,
    respectRecipientTimezone: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
  },
]

const _mockScheduledEmails: ScheduledEmail[] = [
  {
    id: '1',
    campaignId: '1',
    campaignName: 'Q1 Outreach',
    prospectEmail: 'john.smith@techcorp.com',
    prospectName: 'John Smith',
    scheduledFor: '2024-01-25T14:30:00Z',
    status: 'scheduled',
    stepNumber: 1,
  },
]

export default SchedulesTab
