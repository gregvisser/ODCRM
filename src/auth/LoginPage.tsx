import { Box, Button, Flex, Heading, Stack, Text } from '@chakra-ui/react'

type LoginPageProps = {
  onSignIn: () => void
  showConfigWarning: boolean
  disableSignIn?: boolean
}

export default function LoginPage({
  onSignIn,
  showConfigWarning,
  disableSignIn = false,
}: LoginPageProps) {
  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.50" px={6}>
      <Box
        bg="white"
        p={{ base: 8, md: 10 }}
        borderRadius="2xl"
        border="1px solid"
        borderColor="gray.200"
        boxShadow="lg"
        maxW="480px"
        w="100%"
      >
        <Stack spacing={5} textAlign="center">
          <Heading size="lg">Sign in to ODCRM</Heading>
          <Text color="gray.600">
            Access is restricted to approved OpenDoors users. Please sign in with your Microsoft
            account to continue.
          </Text>
          {showConfigWarning ? (
            <Text color="red.500" fontSize="sm">
              Microsoft login is not configured yet. Add the Azure client and tenant IDs in Vercel
              before signing in.
            </Text>
          ) : null}
          <Button colorScheme="gray" size="lg" onClick={onSignIn} isDisabled={disableSignIn}>
            Sign in with Microsoft
          </Button>
        </Stack>
      </Box>
    </Flex>
  )
}
