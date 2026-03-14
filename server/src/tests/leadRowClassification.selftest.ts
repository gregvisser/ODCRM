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
  Company: 'OCS Group Holdings Ltd',
  accountName: 'OCS Group Holdings Ltd',
}

const realNamedLead: Record<string, string> = {
  Date: todayText,
  Company: 'Acme Ltd',
  Name: 'Jane Doe',
  'Channel of Lead': 'LinkedIn',
  'OD Team Member': 'Alex',
}

const realCompanyLead: Record<string, string> = {
  Date: todayText,
  Company: 'Bright Systems',
  'Lead Status': 'Qualified',
  'Channel of Lead': 'Referral',
}

assert.equal(isRealLeadRow(markerRow), false, 'date + company marker row must not count as a lead')
assert.equal(isRealLeadRow(realNamedLead), true, 'named lead row must count as a lead')
assert.equal(isRealLeadRow(realCompanyLead), true, 'company + substantive detail must count as a lead')

const rows: LeadRow[] = [
  { ...markerRow, accountName: 'OCS Group Holdings Ltd' },
  { ...realNamedLead, accountName: 'OCS Group Holdings Ltd' },
  { ...realCompanyLead, accountName: 'OCS Group Holdings Ltd' },
]

const actuals = calculateActualsFromLeads('OCS Group Holdings Ltd', rows)
assert.equal(actuals.weeklyActual, 2, 'weeklyActual must exclude marker rows')
assert.equal(actuals.monthlyActual, 2, 'monthlyActual must exclude marker rows')

console.log('lead row classification self-test passed')
