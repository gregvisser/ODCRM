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
    <Flex minH="100vh" align="center" justify="center" bg="bg.canvas" px={6}>
      <Box
        bg="bg.surface"
        p={{ base: 8, md: 10 }}
        borderRadius="xl"
        border="1px solid"
        borderColor="border.subtle"
        boxShadow="md"
        maxW="480px"
        w="100%"
      >
        <Stack spacing={5} textAlign="center">
          <Heading size="lg">Sign in to ODCRM</Heading>
          <Text color="text.muted">
            Access is restricted to approved OpenDoors users. Please sign in with your Microsoft
            account to continue.
          </Text>
          {showConfigWarning ? (
            <Text color="red.500" fontSize="sm">
              Microsoft login is not configured yet. Add the Azure client and tenant IDs in Vercel
              before signing in.
            </Text>
          ) : null}
          <Button size="lg" onClick={onSignIn} isDisabled={disableSignIn}>
            Sign in with Microsoft
          </Button>
        </Stack>
      </Box>
    </Flex>
  )
}
