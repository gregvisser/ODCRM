import assert from 'node:assert/strict'
import { isRealLeadRow } from '../services/leadCanonicalMapping.js'
import { calculateActualsFromLeads, type LeadRow } from '../types/leads.js'

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

console.log('lead row classification self-test passed')
