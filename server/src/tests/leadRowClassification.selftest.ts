import assert from 'node:assert/strict'
import { isRealLeadRow } from '../services/leadCanonicalMapping.js'
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

console.log('lead row classification self-test passed')
