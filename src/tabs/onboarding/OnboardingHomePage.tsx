import { PlaceholderPage } from '../../components/PlaceholderPage'
import { ListItem, Text, UnorderedList } from '@chakra-ui/react'
import { ONBOARDING_PLANNED_AREAS } from './constants'

export default function OnboardingHomePage() {
  return (
    <PlaceholderPage
      title="Onboarding"
      ownerAgent="Onboarding Agent"
    >
      <Text fontSize="sm" color="gray.700" mb={2}>
        Planned areas:
      </Text>
      <UnorderedList fontSize="sm" color="gray.600" spacing={1} pl={5}>
        {ONBOARDING_PLANNED_AREAS.map((a) => (
          <ListItem key={a}>{a}</ListItem>
        ))}
      </UnorderedList>
    </PlaceholderPage>
  )
}


