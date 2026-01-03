import { Box, Heading, Text, VStack } from '@chakra-ui/react'

export function PlaceholderPage({
  title,
  ownerAgent,
  description,
  children,
}: {
  title: string
  ownerAgent: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <Box>
      <VStack align="start" spacing={2}>
        <Heading size="md">{title}</Heading>
        {description ? <Text color="gray.600">{description}</Text> : null}
        <Text fontSize="sm" color="gray.500">
          Owner: <Box as="span" fontWeight="semibold">{ownerAgent}</Box>
        </Text>
        {children ? <Box pt={2} w="100%">{children}</Box> : null}
      </VStack>
    </Box>
  )
}


