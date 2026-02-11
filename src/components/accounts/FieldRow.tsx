import { Box, SimpleGrid, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'

export function NotSet() {
  return (
    <Text fontSize="sm" color="gray.500">
      Not set
    </Text>
  )
}

export function FieldRow({
  label,
  value,
  children,
}: {
  label: string
  value?: ReactNode
  children?: ReactNode
}) {
  return (
    <Box>
      <Text fontSize="xs" color="gray.600" mb={1} fontWeight="semibold">
        {label}
      </Text>
      <Box>{children ?? value ?? <NotSet />}</Box>
    </Box>
  )
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={6} spacingY={4}>
      {children}
    </SimpleGrid>
  )
}

