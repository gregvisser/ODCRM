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

type DeliverySchedule = {
  id: string
  name: string
  description?: string
  isActive: boolean
  timezone: string
  daysOfWeek: number[] // 0-6, Sunday = 0
  timeWindows: TimeWindow[]
  maxEmailsPerDay: number
  maxEmailsPerHour: number
  respectRecipientTimezone: boolean
  createdAt: string
  updatedAt: string
}

type TimeWindow = {
  startTime: string // HH:MM format
  endTime: string // HH:MM format
  maxEmails: number
}

type ScheduledEmail = {
  id: string
  campaignId: string
  campaignName: string
  prospectEmail: string
  prospectName: string
  scheduledFor: string
  status: 'pending' | 'sent' | 'failed'
  scheduleId: string
}

const SchedulesTab: React.FC = () => {
  const [schedules, setSchedules] = useState<DeliverySchedule[]>([])
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([])
  const [loading, setLoading] = useState(true)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [editingSchedule, setEditingSchedule] = useState<DeliverySchedule | null>(null)
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
        api.get<DeliverySchedule[]>('/api/schedules'),
        api.get<ScheduledEmail[]>('/api/schedules/emails')
      ])

      setSchedules(schedulesRes.data || mockSchedules)
      setScheduledEmails(emailsRes.data || mockScheduledEmails)
    } catch (error) {
      console.error('Failed to load schedules:', error)
      setSchedules(mockSchedules)
      setScheduledEmails(mockScheduledEmails)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const now = new Date()
    const today = now.toDateString()
    const thisWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toDateString()

    return {
      totalSchedules: schedules.length,
      activeSchedules: schedules.filter(s => s.isActive).length,
      todayScheduled: scheduledEmails.filter(e => new Date(e.scheduledFor).toDateString() === today).length,
      thisWeekScheduled: scheduledEmails.filter(e => new Date(e.scheduledFor).toDateString() <= thisWeek).length,
      pendingEmails: scheduledEmails.filter(e => e.status === 'pending').length,
    }
  }, [schedules, scheduledEmails])

  const handleCreateSchedule = () => {
    setEditingSchedule({
      id: '',
      name: '',
      description: '',
      isActive: true,
      timezone: 'America/New_York',
      daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
      timeWindows: [
        { startTime: '09:00', endTime: '17:00', maxEmails: 50 }
      ],
      maxEmailsPerDay: 200,
      maxEmailsPerHour: 10,
      respectRecipientTimezone: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    onOpen()
  }

  const handleEditSchedule = (schedule: DeliverySchedule) => {
    setEditingSchedule(schedule)
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

  const handleToggleSchedule = async (schedule: DeliverySchedule) => {
    try {
      await api.patch(`/api/schedules/${schedule.id}`, { isActive: !schedule.isActive })
      await loadData()
      toast({
        title: `Schedule ${!schedule.isActive ? 'activated' : 'deactivated'}`,
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
          <Heading size="lg">Delivery Schedules</Heading>
          <Text color="gray.600">
            Configure optimal sending times and manage email delivery windows
          </Text>
        </VStack>
        <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={handleCreateSchedule}>
          New Schedule
        </Button>
      </Flex>

      {/* Stats */}
      <SimpleGrid columns={{ base: 2, md: 5 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Schedules</StatLabel>
              <StatNumber>{stats.totalSchedules}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Active</StatLabel>
              <StatNumber>{stats.activeSchedules}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Scheduled Today</StatLabel>
              <StatNumber>{stats.todayScheduled}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Pending Emails</StatLabel>
              <StatNumber>{stats.pendingEmails}</StatNumber>
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

// Mock data for development
const mockSchedules: DeliverySchedule[] = [
  {
    id: '1',
    name: 'Business Hours - EST',
    description: 'Standard business hours for East Coast prospects',
    isActive: true,
    timezone: 'America/New_York',
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
  {
    id: '2',
    name: 'Extended Hours - PST',
    description: 'Extended hours for West Coast and international prospects',
    isActive: true,
    timezone: 'America/Los_Angeles',
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    timeWindows: [
      { startTime: '08:00', endTime: '18:00', maxEmails: 30 },
    ],
    maxEmailsPerDay: 150,
    maxEmailsPerHour: 8,
    respectRecipientTimezone: true,
    createdAt: '2024-01-18T09:15:00Z',
    updatedAt: '2024-01-22T11:20:00Z',
  },
]

const mockScheduledEmails: ScheduledEmail[] = [
  {
    id: '1',
    campaignId: '1',
    campaignName: 'Q1 Product Launch',
    prospectEmail: 'john.smith@techcorp.com',
    prospectName: 'John Smith',
    scheduledFor: '2024-01-25T14:30:00Z',
    status: 'pending',
    scheduleId: '1',
  },
  {
    id: '2',
    campaignId: '2',
    campaignName: 'Newsletter - January',
    prospectEmail: 'sarah.johnson@startup.io',
    prospectName: 'Sarah Johnson',
    scheduledFor: '2024-01-25T16:00:00Z',
    status: 'pending',
    scheduleId: '1',
  },
]

export default SchedulesTab
