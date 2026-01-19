import React from 'react'
import { Box, Button, Heading, Stack, Text } from '@chakra-ui/react'

type ErrorBoundaryProps = {
  children: React.ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  message?: string
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('❌ ODCRM render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box minH="100vh" bg="gray.50" display="flex" alignItems="center" justifyContent="center">
          <Box
            bg="white"
            p={{ base: 8, md: 10 }}
            borderRadius="2xl"
            border="1px solid"
            borderColor="gray.200"
            boxShadow="lg"
            maxW="520px"
            w="100%"
            textAlign="center"
          >
            <Stack spacing={4}>
              <Heading size="md">We hit a loading issue</Heading>
              <Text color="gray.600">
                The app failed to render in the browser. Please refresh. If this keeps happening,
                share this screen with the dev team.
              </Text>
              {this.state.message ? (
                <Text fontSize="sm" color="gray.500">
                  {this.state.message}
                </Text>
              ) : null}
              <Button colorScheme="green" onClick={() => window.location.reload()}>
                Reload
              </Button>
            </Stack>
          </Box>
        </Box>
      )
    }

    return this.props.children
  }
}
