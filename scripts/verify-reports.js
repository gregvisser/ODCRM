#!/usr/bin/env node

/**
 * Verification script for Reports tab accuracy
 * Ensures UI data matches raw EmailEvent queries
 */

const { PrismaClient } = require('../server/node_modules/@prisma/client')

const prisma = new PrismaClient()

async function verifyReports(customerId, dateRange = 'today') {
  console.log(`🔍 Verifying reports for customer: ${customerId}, range: ${dateRange}`)

  // Calculate date range (UTC) - same logic as endpoint
  const now = new Date()
  let startDate
  let endDate = new Date(now)

  switch (dateRange) {
    case 'today':
      startDate = new Date(now)
      startDate.setUTCHours(0, 0, 0, 0)
      endDate.setUTCHours(23, 59, 59, 999)
      break
    case 'week':
      startDate = new Date(now)
      startDate.setUTCDate(startDate.getUTCDate() - 7)
      startDate.setUTCHours(0, 0, 0, 0)
      endDate.setUTCHours(23, 59, 59, 999)
      break
    case 'month':
      startDate = new Date(now)
      startDate.setUTCMonth(startDate.getUTCMonth() - 1)
      startDate.setUTCHours(0, 0, 0, 0)
      endDate.setUTCHours(23, 59, 59, 999)
      break
  }

  console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)

  // Get raw event counts (same query as endpoint)
  const eventCounts = await prisma.emailEvent.groupBy({
    by: ['type'],
    where: {
      customerId,
      occurredAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _count: {
      id: true,
    },
  })

  // Convert to map
  const counts = {}
  eventCounts.forEach(event => {
    counts[event.type] = event._count.id
  })

  // Calculate metrics (same formulas as endpoint)
  const sent = counts.sent || 0
  const delivered = counts.delivered || 0
  const opened = counts.opened || 0
  const clicked = counts.clicked || 0
  const replied = counts.replied || 0
  const bounced = counts.bounced || 0
  const optedOut = counts.opted_out || 0
  const spamComplaints = counts.spam_complaint || 0
  const failed = counts.failed || 0
  const notReached = counts.not_reached || 0

  const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0
  const openRate = delivered > 0 ? (opened / delivered) * 100 : 0
  const clickRate = delivered > 0 ? (clicked / delivered) * 100 : 0
  const replyRate = delivered > 0 ? (replied / delivered) * 100 : 0
  const bounceRate = sent > 0 ? (bounced / sent) * 100 : 0
  const optOutRate = delivered > 0 ? (optedOut / delivered) * 100 : 0
  const notReachedRate = sent > 0 ? ((failed + notReached) / sent) * 100 : 0

  // Get sequences completed
  const sequencesCompletedResult = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT es.id) as count
    FROM email_sequences es
    INNER JOIN sequence_enrollments se ON es.id = se.sequenceId
    WHERE es.customerId = ${customerId}
      AND se.status = 'completed'
  `
  const sequencesCompleted = Number(sequencesCompletedResult[0]?.count || 0)

  console.log('\n📊 RAW EVENT COUNTS:')
  console.log(`Sent: ${sent}`)
  console.log(`Delivered: ${delivered}`)
  console.log(`Opened: ${opened}`)
  console.log(`Clicked: ${clicked}`)
  console.log(`Replied: ${replied}`)
  console.log(`Bounced: ${bounced}`)
  console.log(`Opted Out: ${optedOut}`)
  console.log(`Spam Complaints: ${spamComplaints}`)
  console.log(`Failed: ${failed}`)
  console.log(`Not Reached: ${notReached}`)

  console.log('\n📈 CALCULATED RATES:')
  console.log(`Delivery Rate: ${deliveryRate.toFixed(1)}% (${delivered}/${sent})`)
  console.log(`Open Rate: ${openRate.toFixed(1)}% (${opened}/${delivered})`)
  console.log(`Click Rate: ${clickRate.toFixed(1)}% (${clicked}/${delivered})`)
  console.log(`Reply Rate: ${replyRate.toFixed(1)}% (${replied}/${delivered})`)
  console.log(`Bounce Rate: ${bounceRate.toFixed(1)}% (${bounced}/${sent})`)
  console.log(`Opt-out Rate: ${optOutRate.toFixed(1)}% (${optedOut}/${delivered})`)
  console.log(`Not Reached Rate: ${notReachedRate.toFixed(1)}% (${failed + notReached}/${sent})`)

  console.log('\n✅ SEQUENCES:')
  console.log(`Completed: ${sequencesCompleted}`)

  // Compare with API response
  console.log('\n🔗 API VERIFICATION:')
  console.log('Run this command to compare with API response:')
  console.log(`curl "http://localhost:3001/api/reports/customer?customerId=${customerId}&dateRange=${dateRange}" -H "X-Customer-Id: ${customerId}" | jq .`)

  await prisma.$disconnect()
}

// Main execution
const args = process.argv.slice(2)
if (args.length < 1) {
  console.log('Usage: node verify-reports.js <customerId> [dateRange]')
  console.log('Example: node verify-reports.js cust-123 today')
  process.exit(1)
}

const customerId = args[0]
const dateRange = args[1] || 'today'

verifyReports(customerId, dateRange).catch(console.error)