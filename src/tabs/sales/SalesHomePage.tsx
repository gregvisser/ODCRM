import { PlaceholderPage } from '../../components/PlaceholderPage'
import { ListItem, Text, UnorderedList } from '@chakra-ui/react'
import { SALES_PLANNED_AREAS } from './constants'

export default function SalesHomePage() {
  return (
    <PlaceholderPage
      title="OpenDoors Sales"
      ownerAgent="Sales Agent"
    >
      <Text fontSize="sm" color="gray.700" mb={2}>
        Planned areas:
      </Text>
      <UnorderedList fontSize="sm" color="gray.600" spacing={1} pl={5}>
        {SALES_PLANNED_AREAS.map((a) => (
          <ListItem key={a}>{a}</ListItem>
        ))}
      </UnorderedList>
    </PlaceholderPage>
  )
}


