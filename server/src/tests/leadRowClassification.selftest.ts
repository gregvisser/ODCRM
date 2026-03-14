import assert from 'node:assert/strict'
import { isRealLeadRow } from '../services/leadCanonicalMapping.js'
import { calculateStoredLeadMetrics } from '../services/leadMetrics.js'
import { calculateActualsFromLeads, type LeadRow } from '../types/leads.js'
import { limitRowsToActiveSheetTable } from '../workers/leadsSync.js'

function formatSheetDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  return `${day}.${month}.${year}`
}

const today = new Date()
today.setHours(0, 0, 0, 0)
const todayText = formatSheetDate(today)

const markerRow: Record<string, string> = {
  Date: todayText,
  Week: `W/C ${todayText}`,
  Company: 'OCS Group Holdings Ltd',
  accountName: 'OCS Group Holdings Ltd',
}

const companyWithoutChannel: Record<string, string> = {
  Date: todayText,
  Company: 'Acme Ltd',
  'OD Team Member': 'Alex',
}

const realCompanyChannelLead: Record<string, string> = {
  Date: todayText,
  Company: 'Acme Ltd',
  'Channel of Lead': 'LinkedIn',
  'OD Team Member': 'Alex',
}

const fullLead: Record<string, string> = {
  Date: todayText,
  Company: 'Bright Systems',
  Name: 'Jane Doe',
  'Channel of Lead': 'Referral',
  'Lead Status': 'Qualified',
  Email: 'jane@example.com',
  'OD Team Member': 'Alex',
}

assert.equal(isRealLeadRow(markerRow, { sourceType: 'google_sheets' }), false, 'date/week marker row must not count as a lead')
assert.equal(isRealLeadRow(companyWithoutChannel, { sourceType: 'google_sheets' }), false, 'date + company without channel must not count as a lead')
assert.equal(isRealLeadRow(realCompanyChannelLead, { sourceType: 'google_sheets' }), true, 'date + company + channel must count as a lead')
assert.equal(isRealLeadRow(fullLead, { sourceType: 'google_sheets' }), true, 'normal populated lead row must count as a lead')

const rows: LeadRow[] = [
  { ...markerRow, accountName: 'OCS Group Holdings Ltd' },
  { ...companyWithoutChannel, accountName: 'OCS Group Holdings Ltd' },
  { ...realCompanyChannelLead, accountName: 'OCS Group Holdings Ltd' },
  { ...fullLead, accountName: 'OCS Group Holdings Ltd' },
]

const actuals = calculateActualsFromLeads('OCS Group Holdings Ltd', rows)
assert.equal(actuals.weeklyActual, 2, 'weeklyActual must exclude marker rows')
assert.equal(actuals.monthlyActual, 2, 'monthlyActual must exclude marker rows')

const detachedDuplicateLead: Record<string, string> = {
  Week: 'Lead 3',
  Date: todayText,
  Company: 'University of Hull',
  Name: 'Chris Burton',
  'Job Title': 'Assoc Director of Estates Ops',
  'Contact Info': 'c.bruton@hull.ac.uk',
  'Channel of Lead': 'Telesales',
}

const activeTableRows = [
  Object.keys(realCompanyChannelLead).map((key) => realCompanyChannelLead[key] || ''),
  [],
  Object.keys(fullLead).map((key) => fullLead[key] || ''),
  ...Array.from({ length: 25 }, () => [] as string[]),
  Object.keys(detachedDuplicateLead).map((key) => detachedDuplicateLead[key] || ''),
]

const tableBoundary = limitRowsToActiveSheetTable(activeTableRows)
assert.equal(tableBoundary.truncated, true, 'a long blank gap must terminate the active table')
assert.equal(tableBoundary.blankRowsIncluded, 25, 'the blank gap length should be reported for diagnostics')
assert.equal(tableBoundary.rows.length, activeTableRows.length - 1, 'detached rows after the blank gap must be ignored')

const ocsMarchRows: LeadRow[] = [
  {
    accountName: 'OCS',
    Week: '9',
    Date: '02.03.26',
  },
  {
    accountName: 'OCS',
    Week: 'Lead 1',
    Date: '04.03.26',
    Company: 'CRUK Scotland Institute',
    Name: 'Steven Cunningham',
    'Channel of Lead': 'Telesales',
  },
  {
    accountName: 'OCS',
    Week: '10',
    Date: '09.03.26',
  },
  {
    accountName: 'OCS',
    Week: 'Lead 1',
    Date: '10.03.26',
    Company: 'University of Hull',
    Name: 'Chris Bruton',
    'Channel of Lead': 'Telesales',
  },
  {
    accountName: 'OCS',
    Week: 'Lead 1',
    Date: '10.03.26',
    Company: 'University of Wales Trinity Saint David',
    Name: 'Callum Williams',
    'Channel of Lead': 'Telesales',
  },
  {
    accountName: 'OCS',
    Week: 'Lead 2',
    Date: '10.03.26',
    Company: 'St Lukes Hospital',
    Name: 'Martin Quinlivan',
    'Channel of Lead': 'Telesales',
  },
]

const ocsMarchActuals = calculateActualsFromLeads('OCS', ocsMarchRows)
assert.equal(ocsMarchActuals.weeklyActual, 3, 'OCS-style week/date marker rows must not inflate weeklyActual')
assert.equal(ocsMarchActuals.monthlyActual, 4, 'OCS-style week/date marker rows must not inflate monthlyActual')

const greenSparseLead: LeadRow = {
  accountName: 'GreenTheUK',
  Week: 'Lead 1',
  Date: '10.03.26',
  Company: 'Keepmoat Homes',
  'Full Name': 'Laura Grainger',
  'Job Title': 'Social Value Manager',
  Email: 'Laura.grainger@keepmoat.com',
  'OD Team Member': 'Elys',
  'OD Notes': 'Laura is free tomorrow pm, Monday from 11am or Wednesday pm',
  'GTUK Team': 'SP',
  'Lead Channel': 'LinkedIn',
  'First Meeting Date': '11/03/2026',
}

assert.equal(
  isRealLeadRow(greenSparseLead, { sourceType: 'google_sheets' }),
  true,
  'GreenTheUK sparse rows with Lead Channel must count as real leads',
)

const greenMarchRows: LeadRow[] = [
  { accountName: 'GreenTheUK', Week: '10', Date: '09.03.26' },
  greenSparseLead,
  {
    accountName: 'GreenTheUK',
    Week: 'Lead 2',
    Date: '10.03.26',
    Company: 'Frazer Nash Consultancy',
    'Full Name': 'Caitlin Ford',
    'Job Title': 'Social Value Strategy',
    Email: 'E - caitlin.ford@fnc.co.uk',
    'Phone Number': 'T - 01283 517789',
    'OD Team Member': 'Joe',
    'OD Notes': 'Caitlin is interested in our initiatives and ways we can work together. She is available on Friday afternoon.',
    'Lead Channel': 'Individual Email',
  },
  {
    accountName: 'GreenTheUK',
    Week: 'Lead 3',
    Date: '10.03.26',
    Company: "McBain's",
    'Full Name': 'Anna Fallon',
    'Job Title': 'Social Value Manager',
    Email: 'Email address - afallon@mcbains.co.uk',
    'Phone Number': 'Phone Number - 07758 370118',
    'OD Team Member': 'Elys',
    'OD Notes': "She would like a call this Thursday afternoon. She didn't get back to me, so Adam has called to qualify this",
    'GTUK Team': 'FT',
    'Lead Channel': 'LinkedIn',
    'First Meeting Date': '11/03/2026',
  },
  {
    accountName: 'GreenTheUK',
    Week: 'Lead 4',
    Date: '10.03.26',
    Company: 'AmcoGiffen',
    'Full Name': 'Kelly Sowden',
    'Job Title': 'Social Value Manager',
    Email: 'kelly.sowden@amcogiffen.co.uk',
    'OD Team Member': 'Elys',
    'OD Notes': 'Kelly would like a call on either Thursday 12 March between 12pm and 2pm or Friday 13th of March between 12pm and 2pm.',
    'GTUK Team': 'SP',
    'Lead Channel': 'LinkedIn',
    'First Meeting Date': '12/03/2026',
  },
  {
    accountName: 'GreenTheUK',
    Week: 'Lead 5',
    Date: '11.03.26',
    Company: 'Wynne Construction',
    'Full Name': 'Natasha Pryce',
    'Job Title': 'Social Value Manager',
    Email: 'natasha.pryce@wynneconstruction.co.uk',
    'OD Team Member': 'Elys',
    'OD Notes': 'Natasha Pryce would like a call 30th March.',
    'Lead Channel': 'LinkedIn',
  },
  {
    accountName: 'GreenTheUK',
    Week: 'Lead 6',
    Date: '12.03.26',
    Company: 'Stay Camden',
    'Full Name': 'Tem Tempest - Roe',
    'Job Title': 'Head of Marketing',
    Email: 'tem@stay.com',
    'Phone Number': 'M- 07485334679',
    'OD Team Member': 'Joe',
    'OD Notes': 'Tem is interested in volunteering projects in the local area.',
    'Lead Channel': 'Individual Email',
  },
  { accountName: 'GreenTheUK', Week: '9', Date: '02.03.26' },
  {
    accountName: 'GreenTheUK',
    Week: 'Lead 7',
    Date: '02.03.26',
    Company: 'Specsavers',
    'Full Name': 'Mark Edwards',
    'Job Title': 'UK Environmental Manager',
    Email: 'Mark.edwards2@visionlabs.co.uk',
    'OD Team Member': 'Dani',
    'OD Notes': 'Mark is currently looking at planting wildflower meadows and trees for one of their UK sites.',
    'GTUK Team': 'FT',
    'Lead Channel': 'LinkedIn',
    'First Meeting Date': '05/03/2026',
  },
  {
    accountName: 'GreenTheUK',
    Week: 'Lead 8',
    Date: '04.03.26',
    Company: 'Bouygues',
    'Full Name': 'Jeff Joseph',
    'Job Title': 'Head of Social Value UK',
    Email: 'jeff.jospeh@bouygues-uk.com',
    'OD Team Member': 'Elys',
    'OD Notes': 'Head of Sustainability responded and asked for a follow-up pitch.',
    'GTUK Team': 'SP',
    'Lead Channel': 'LinkedIn',
  },
  {
    accountName: 'GreenTheUK',
    Week: 'Lead 9',
    Date: '04.03.26',
    Company: 'Bailey Partnership',
    'Full Name': 'Karen Albaster-Oliver',
    'Job Title': 'Social Value Lead',
    Email: 'karen.alabaster-oliver@bailey-p.net',
    'OD Team Member': 'Elys',
    'OD Notes': 'Elys has forwarded the meeting invite.',
    'GTUK Team': 'FT',
    'Lead Channel': 'LinkedIn',
    'First Meeting Date': '27/03/2026',
  },
  {
    accountName: 'GreenTheUK',
    Week: 'Lead 10',
    Date: '04.03.26',
    Company: 'Gleeson Homes',
    'Full Name': 'Shelby Thomson',
    'Job Title': 'Environmental Manager',
    Email: 'Shelbey.thomson@mjgleeson.com',
    'OD Team Member': 'Dani',
    'OD Notes': 'Shelby is interested in a call and was busy this week.',
    'GTUK Team': 'SP',
    'Lead Channel': 'LinkedIn',
    'First Meeting Date': '11/03/2026',
  },
  {
    accountName: 'GreenTheUK',
    Week: 'Lead 11',
    Date: '04.03.26',
    Company: '0800 Repair / PHS Homes Solutions Group',
    'Full Name': 'Joanne Oakes',
    'Job Title': 'Social Value Manager',
    Email: 'joanne.oakes@0800repair.com',
    'OD Team Member': 'Dani',
    'OD Notes': 'Joanne is very interested in a call and is available Tuesday or Thursday next week.',
    'GTUK Team': 'FT',
    'Lead Channel': 'LinkedIn',
    'First Meeting Date': '10/03/2026',
  },
  { accountName: 'GreenTheUK', Week: '11', Date: '16.03.26' },
]

const greenMarchActuals = calculateActualsFromLeads('GreenTheUK', greenMarchRows)
assert.equal(greenMarchActuals.weeklyActual, 6, 'GreenTheUK weeklyActual must count real sparse rows')
assert.equal(greenMarchActuals.monthlyActual, 11, 'GreenTheUK monthlyActual must count real sparse rows')

const metricsRanges = {
  todayStart: new Date('2026-03-10T00:00:00.000Z'),
  todayEnd: new Date('2026-03-11T00:00:00.000Z'),
  weekStart: new Date('2026-03-09T00:00:00.000Z'),
  weekEnd: new Date('2026-03-16T00:00:00.000Z'),
  monthStart: new Date('2026-03-01T00:00:00.000Z'),
  monthEnd: new Date('2026-04-01T00:00:00.000Z'),
}

const storedOcsRows = ocsMarchRows.map((row) => ({
  occurredAt: row.Date ? new Date(`20${row.Date.slice(6, 8)}-${row.Date.slice(3, 5)}-${row.Date.slice(0, 2)}T00:00:00.000Z`) : null,
  createdAt: new Date('2026-03-10T09:00:00.000Z'),
  externalSourceType: 'google_sheets',
  source: row['Channel of Lead'] || null,
  owner: row['OD Team Member'] || null,
  company: row.Company || null,
  fullName: row.Name || null,
  email: row.Email || null,
  phone: row['Phone Number'] || row.Phone || null,
  jobTitle: row['Job Title'] || null,
  location: row.Location || null,
  status: row['Lead Status'] || null,
  notes: row['OD Notes'] || null,
  data: row,
}))

const storedGreenRows = greenMarchRows.map((row) => ({
  occurredAt: row.Date ? new Date(`20${row.Date.slice(6, 8)}-${row.Date.slice(3, 5)}-${row.Date.slice(0, 2)}T00:00:00.000Z`) : null,
  createdAt: new Date('2026-03-10T09:00:00.000Z'),
  externalSourceType: 'google_sheets',
  source: row['Lead Channel'] || row['Channel of Lead'] || null,
  owner: row['OD Team Member'] || null,
  company: row.Company || null,
  fullName: row['Full Name'] || row.Name || null,
  email: row.Email || null,
  phone: row['Phone Number'] || row.Phone || null,
  jobTitle: row['Job Title'] || null,
  location: row.Location || null,
  status: row['Lead Status'] || null,
  notes: row['OD Notes'] || null,
  data: row,
}))

const storedOcsMetrics = calculateStoredLeadMetrics(storedOcsRows, metricsRanges)
assert.equal(storedOcsMetrics.week, 3, 'stored OCS metrics must reject marker rows and match weekly truth')
assert.equal(storedOcsMetrics.month, 4, 'stored OCS metrics must reject marker rows and match monthly truth')
assert.equal(storedOcsMetrics.total, 4, 'stored OCS metrics total must match real lead rows only')

const storedGreenMetrics = calculateStoredLeadMetrics(storedGreenRows, metricsRanges)
assert.equal(storedGreenMetrics.week, 6, 'stored GreenTheUK metrics must count real sparse rows in the active week')
assert.equal(storedGreenMetrics.month, 11, 'stored GreenTheUK metrics must count all real March sparse rows')
assert.equal(storedGreenMetrics.total, 11, 'stored GreenTheUK metrics total must match accepted sparse rows only')

console.log('lead row classification self-test passed')
