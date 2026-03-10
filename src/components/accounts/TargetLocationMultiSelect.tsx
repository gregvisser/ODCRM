import { useState } from 'react'
import { SearchIcon } from '@chakra-ui/icons'
import { Box, Input, InputGroup, InputRightElement, Stack, Tag, TagCloseButton, TagLabel, Text, Wrap, WrapItem } from '@chakra-ui/react'

const UK_AREAS = [
  'United Kingdom',
  'London', 'Birmingham', 'Manchester', 'Glasgow', 'Liverpool', 'Leeds', 'Edinburgh', 'Bristol',
  'Cardiff', 'Belfast', 'Newcastle', 'Sheffield', 'Leicester', 'Coventry', 'Nottingham', 'Southampton',
  'Portsmouth', 'Brighton', 'Reading', 'Northampton', 'Luton', 'Bolton', 'Bournemouth', 'Norwich',
  'Swindon', 'Southend-on-Sea', 'Middlesbrough', 'Peterborough', 'Cambridge', 'Oxford', 'Ipswich',
  'Slough', 'Blackpool', 'Milton Keynes', 'York', 'Huddersfield', 'Telford', 'Derby', 'Plymouth',
  'Wolverhampton', 'Stoke-on-Trent', 'Swansea', 'Salford', 'Aberdeen', 'Westminster', 'Westminster',
  'Croydon', 'Wandsworth', 'Ealing', 'Hillingdon', 'Hounslow', 'Richmond upon Thames', 'Kingston upon Thames',
  'Merton', 'Sutton', 'Bromley', 'Lewisham', 'Greenwich', 'Bexley', 'Havering', 'Barking and Dagenham',
  'Redbridge', 'Newham', 'Tower Hamlets', 'Hackney', 'Islington', 'Camden', 'Westminster', 'Kensington and Chelsea',
  'Hammersmith and Fulham', 'Wandsworth', 'Lambeth', 'Southwark', 'Birmingham', 'Coventry', 'Dudley',
  'Sandwell', 'Solihull', 'Walsall', 'Wolverhampton', 'Bradford', 'Calderdale', 'Kirklees', 'Leeds',
  'Wakefield', 'Gateshead', 'Newcastle upon Tyne', 'North Tyneside', 'South Tyneside', 'Sunderland',
  'Liverpool', 'Knowsley', 'Sefton', 'St Helens', 'Wirral', 'Bolton', 'Bury', 'Manchester', 'Oldham',
  'Rochdale', 'Salford', 'Stockport', 'Tameside', 'Trafford', 'Wigan', 'Blackburn with Darwen', 'Blackpool',
  'Burnley', 'Chorley', 'Fylde', 'Hyndburn', 'Lancaster', 'Pendle', 'Preston', 'Ribble Valley', 'Rossendale',
  'South Ribble', 'West Lancashire', 'Wyre', 'Barnsley', 'Doncaster', 'Rotherham', 'Sheffield', 'Bath and North East Somerset',
  'Bristol', 'North Somerset', 'South Gloucestershire', 'Isle of Wight', 'Portsmouth', 'Southampton',
  'Brighton and Hove', 'Milton Keynes', 'Reading', 'Slough', 'Windsor and Maidenhead', 'Wokingham',
  'Cambridge', 'East Cambridgeshire', 'Fenland', 'Huntingdonshire', 'Peterborough', 'South Cambridgeshire',
  'Basildon', 'Braintree', 'Brentwood', 'Castle Point', 'Chelmsford', 'Colchester', 'Epping Forest',
  'Harlow', 'Maldon', 'Rochford', 'Southend-on-Sea', 'Tendring', 'Thurrock', 'Uttlesford', 'Norwich',
  'Great Yarmouth', 'King\'s Lynn and West Norfolk', 'North Norfolk', 'South Norfolk', 'Breckland',
  'Broadland', 'Ipswich', 'Babergh', 'East Suffolk', 'Mid Suffolk', 'West Suffolk',
].sort()

type TargetLocationMultiSelectProps = {
  locations: string[]
  onLocationsChange: (locations: string[]) => void
}

export default function TargetLocationMultiSelect({
  locations,
  onLocationsChange,
}: TargetLocationMultiSelectProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const filteredAreas = UK_AREAS.filter((area) =>
    area.toLowerCase().includes(searchTerm.toLowerCase()),
  ).filter((area) => !locations.includes(area))

  const handleAddLocation = (area: string) => {
    if (!locations.includes(area)) {
      onLocationsChange([...locations, area])
    }
    setSearchTerm('')
    setIsOpen(false)
  }

  const handleRemoveLocation = (area: string) => {
    onLocationsChange(locations.filter((loc) => loc !== area))
  }

  return (
    <Stack spacing={3}>
      <InputGroup>
        <Input
          placeholder="Search UK areas (e.g., London, Manchester)..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
        />
        <InputRightElement>
          <SearchIcon color="gray.400" />
        </InputRightElement>
      </InputGroup>

      {isOpen && searchTerm && filteredAreas.length > 0 && (
        <Box
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
          bg="white"
          maxH="200px"
          overflowY="auto"
          boxShadow="md"
          position="absolute"
          zIndex={10}
          mt="40px"
          w="100%"
        >
          <Stack spacing={0}>
            {filteredAreas.slice(0, 10).map((area) => (
              <Box
                key={area}
                px={4}
                py={2}
                cursor="pointer"
                _hover={{ bg: 'gray.100' }}
                onClick={() => handleAddLocation(area)}
              >
                <Text fontSize="sm">{area}</Text>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {locations.length > 0 && (
        <Wrap spacing={2}>
          {locations.map((location) => (
            <WrapItem key={location}>
              <Tag size="md" colorScheme="gray" borderRadius="full">
                <TagLabel>{location}</TagLabel>
                <TagCloseButton onClick={() => handleRemoveLocation(location)} />
              </Tag>
            </WrapItem>
          ))}
        </Wrap>
      )}

      {locations.length === 0 && (
        <Text fontSize="sm" color="gray.500">
          No target locations selected. Start typing to search UK areas.
        </Text>
      )}
    </Stack>
  )
}
