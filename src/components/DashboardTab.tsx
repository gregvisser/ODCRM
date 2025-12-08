import {
  Badge,
  Box,
  Divider,
  Heading,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'

const kpis = [
  { label: 'Qualified leads', value: '248', change: '+12% vs last week' },
  { label: 'Active campaigns', value: '18', change: '3 ending soon' },
  { label: 'Avg. CPL', value: '$42.10', change: '-5% vs goal' },
]

const initiatives = [
  { name: 'LinkedIn ABM Sprint', owner: 'Nadine', status: 'On track' },
  { name: 'Meta Always-on', owner: 'Leo', status: 'Needs creative' },
  { name: 'Partner Webinars', owner: 'Priya', status: 'In prep' },
]

function DashboardTab() {
  return (
    <Stack spacing={10}>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap={6}>
        {kpis.map((kpi) => (
          <Box
            key={kpi.label}
            bg="white"
            borderRadius="lg"
            border="1px solid"
            borderColor="gray.100"
            p={6}
            boxShadow="sm"
          >
            <Text fontSize="sm" color="gray.500">
              {kpi.label}
            </Text>
            <Heading size="lg" mt={2}>
              {kpi.value}
            </Heading>
            <Text fontSize="sm" color="teal.600" mt={1}>
              {kpi.change}
            </Text>
          </Box>
        ))}
      </SimpleGrid>

      <Box
        bg="white"
        borderRadius="lg"
        border="1px solid"
        borderColor="gray.100"
        p={6}
        boxShadow="sm"
      >
        <Heading size="md" mb={4}>
          Campaign initiatives
        </Heading>
        <Stack spacing={4}>
          {initiatives.map((initiative) => (
            <Box key={initiative.name}>
              <Stack direction={{ base: 'column', md: 'row' }} justify="space-between">
                <Box>
                  <Text fontWeight="medium">{initiative.name}</Text>
                  <Text fontSize="sm" color="gray.500">
                    Owner: {initiative.owner}
                  </Text>
                </Box>
                <Badge
                  colorScheme={
                    initiative.status === 'On track'
                      ? 'green'
                      : initiative.status === 'Needs creative'
                        ? 'orange'
                        : 'purple'
                  }
                  alignSelf="flex-start"
                >
                  {initiative.status}
                </Badge>
              </Stack>
              <Divider mt={3} />
            </Box>
          ))}
        </Stack>
      </Box>
    </Stack>
  )
}

export default DashboardTab

