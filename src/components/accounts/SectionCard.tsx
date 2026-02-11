import { Box, type BoxProps, Heading, Stack } from '@chakra-ui/react'
import type { ReactNode } from 'react'

export function SectionCard({
  title,
  right,
  children,
  ...boxProps
}: {
  title: string
  right?: ReactNode
  children: ReactNode
} & BoxProps) {
  return (
    <Box
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      bg="white"
      px={{ base: 4, md: 6 }}
      py={{ base: 4, md: 5 }}
      w="full"
      {...boxProps}
    >
      <Stack spacing={4}>
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={3}>
          <Heading size="sm" fontWeight="bold">
            {title}
          </Heading>
          {right ? <Box>{right}</Box> : null}
        </Box>
        {children}
      </Stack>
    </Box>
  )
}

