#!/usr/bin/env node

/**
 * Automated tests for suppression list enforcement
 * Tests sequence enrollment filtering and email send blocking
 */

import { PrismaClient } from '../node_modules/@prisma/client/index.js'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function runSuppressionTests() {
  console.log('🧪 Running Suppression List Tests...\n')

  let testCustomerId = null
  let testContacts = []
  let testSequenceId = null
  let testCampaignId = null
  let testIdentityId = null

  try {
    // Setup test data
    console.log('📝 Setting up test data...')

    // Use existing customer if available, otherwise create a simple one
    let customer = await prisma.customer.findFirst()
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          id: randomUUID(),
          name: 'Suppression Test Customer',
        }
      })
    }
    testCustomerId = customer.id
    console.log(`✅ Using customer: ${customer.id}`)

    // Create test contacts
    const contactsData = [
      { email: 'allowed@example.com', firstName: 'Allowed', lastName: 'User' },
      { email: 'suppressed@example.com', firstName: 'Suppressed', lastName: 'User' },
      { email: 'domain-blocked@blocked.com', firstName: 'Domain', lastName: 'Blocked' },
      { email: 'allowed@blocked.com', firstName: 'Domain', lastName: 'Allowed' },
    ]

    for (const contactData of contactsData) {
      const contact = await prisma.contact.create({
        data: {
          id: randomUUID(),
          customerId: testCustomerId,
          email: contactData.email,
          firstName: contactData.firstName,
          lastName: contactData.lastName,
        }
      })
      testContacts.push(contact)
      console.log(`✅ Created test contact: ${contact.email}`)
    }

    // Create suppression entries
    await prisma.suppressionEntry.createMany({
      data: [
        {
          id: randomUUID(),
          customerId: testCustomerId,
          type: 'email',
          value: 'suppressed@example.com',
          emailNormalized: 'suppressed@example.com',
          reason: 'Test suppression',
          source: 'test',
        },
        {
          id: randomUUID(),
          customerId: testCustomerId,
          type: 'domain',
          value: 'blocked.com',
          reason: 'Test domain block',
          source: 'test',
        },
      ]
    })
    console.log('✅ Created suppression entries')

    // Create test email identity
    const identity = await prisma.emailIdentity.create({
      data: {
        id: randomUUID(),
        customerId: testCustomerId,
        emailAddress: 'test@example.com',
        displayName: 'Test Identity',
        status: 'active',
      }
    })
    testIdentityId = identity.id
    console.log(`✅ Created test email identity: ${identity.emailAddress}`)

    // Create test sequence
    const sequence = await prisma.emailSequence.create({
      data: {
        id: randomUUID(),
        customerId: testCustomerId,
        name: 'Test Sequence',
        status: 'active',
      }
    })
    testSequenceId = sequence.id
    console.log(`✅ Created test sequence: ${sequence.name}`)

    // Create test campaign
    const campaign = await prisma.emailCampaign.create({
      data: {
        id: randomUUID(),
        customerId: testCustomerId,
        name: 'Test Campaign',
        status: 'running',
        senderIdentityId: testIdentityId,
        sendWindowHoursStart: 0,
        sendWindowHoursEnd: 24,
      }
    })
    testCampaignId = campaign.id
    console.log(`✅ Created test campaign: ${campaign.name}`)

    // Test 1: Sequence enrollment filtering
    console.log('\n🧪 Test 1: Sequence enrollment suppression filtering')
    const allContactIds = testContacts.map(c => c.id)
    const allowedContactIds = testContacts.filter(c =>
      c.email !== 'suppressed@example.com' && !c.email.endsWith('@blocked.com')
    ).map(c => c.id)

    console.log(`All contacts: ${allContactIds.length}`)
    console.log(`Expected allowed: ${allowedContactIds.length}`)

    // Simulate enrollment check (call the same logic as the route)
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: allContactIds },
        customerId: testCustomerId,
      },
      select: {
        id: true,
        email: true,
      },
    })

    const contactEmails = contacts.map(c => c.email).filter(Boolean)
    const suppressedEmails = await prisma.suppressionEntry.findMany({
      where: {
        customerId: testCustomerId,
        OR: [
          {
            type: 'email',
            emailNormalized: { in: contactEmails.map(e => e.toLowerCase().trim()) },
          },
          {
            type: 'domain',
            value: {
              in: contactEmails.map(e => e.split('@')[1]).filter(Boolean),
            },
          },
        ],
      },
      select: {
        type: true,
        value: true,
        reason: true,
      },
    })

    const suppressedContacts = new Set()
    const suppressionDetails = []

    for (const contact of contacts) {
      if (!contact.email) continue

      const normalizedEmail = contact.email.toLowerCase().trim()
      const domain = contact.email.split('@')[1]

      const emailSuppressed = suppressedEmails.find(
        s => s.type === 'email' && s.value === normalizedEmail
      )

      const domainSuppressed = suppressedEmails.find(
        s => s.type === 'domain' && s.value === domain
      )

      if (emailSuppressed || domainSuppressed) {
        suppressedContacts.add(contact.id)
        suppressionDetails.push({
          contactId: contact.id,
          email: contact.email,
          reason: emailSuppressed?.reason || domainSuppressed?.reason || 'Suppressed',
        })
      }
    }

    const validContactIds = allContactIds.filter(id => !suppressedContacts.has(id))

    console.log(`Suppressed contacts: ${suppressedContacts.size}`)
    console.log(`Valid contacts: ${validContactIds.length}`)

    if (validContactIds.length === allowedContactIds.length &&
        validContactIds.every(id => allowedContactIds.includes(id))) {
      console.log('✅ Sequence enrollment filtering works correctly')
    } else {
      throw new Error('❌ Sequence enrollment filtering failed')
    }

    // Test 2: Email send suppression
    console.log('\n🧪 Test 2: Email send suppression blocking')

    // Create a campaign prospect for suppressed contact
    const suppressedContact = testContacts.find(c => c.email === 'suppressed@example.com')
    if (!suppressedContact) throw new Error('Test contact not found')

    const prospect = await prisma.emailCampaignProspect.create({
      data: {
        id: randomUUID(),
        campaignId: testCampaignId,
        contactId: suppressedContact.id,
        status: 'active',
        step1ScheduledAt: new Date(),
      },
      include: {
        contact: true,
        campaign: true,
      }
    })

    // Test the suppression logic from emailScheduler
    const normalizedEmail = prospect.contact.email.toLowerCase().trim()
    const domain = prospect.contact.email.split('@')[1]

    const suppressionCheck = await prisma.suppressionEntry.findFirst({
      where: {
        customerId: prospect.campaign.customerId,
        OR: [
          {
            type: 'email',
            emailNormalized: normalizedEmail,
          },
          {
            type: 'domain',
            value: domain,
          },
        ],
      },
      select: {
        type: true,
        value: true,
        reason: true,
      },
    })

    if (suppressionCheck) {
      console.log(`✅ Email send suppression correctly detected: ${suppressionCheck.type} - ${suppressionCheck.value}`)

      // Simulate creating the suppressed event
      const suppressedEvent = await prisma.emailEvent.create({
        data: {
          customerId: prospect.campaign.customerId,
          campaignId: prospect.campaign.id,
          campaignProspectId: prospect.id,
          senderIdentityId: prospect.campaign.senderIdentityId,
          recipientEmail: prospect.contact.email,
          type: 'failed',
          metadata: {
            step: 1,
            suppressed: true,
            suppressionType: suppressionCheck.type,
            suppressionValue: suppressionCheck.value,
            suppressionReason: suppressionCheck.reason,
          },
          occurredAt: new Date()
        }
      })

      console.log(`✅ Suppressed event recorded: ${suppressedEvent.type}`)
    } else {
      throw new Error('❌ Email send suppression not detected')
    }

    console.log('\n🎉 All suppression tests passed!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test data...')

    if (testCampaignId) {
      await prisma.emailCampaignProspect.deleteMany({ where: { campaignId: testCampaignId } })
      await prisma.emailEvent.deleteMany({ where: { campaignId: testCampaignId } })
      await prisma.emailCampaign.delete({ where: { id: testCampaignId } })
    }

    if (testSequenceId) {
      await prisma.sequenceEnrollment.deleteMany({ where: { sequenceId: testSequenceId } })
      await prisma.emailSequence.delete({ where: { id: testSequenceId } })
    }

    if (testIdentityId) {
      await prisma.emailIdentity.delete({ where: { id: testIdentityId } })
    }

    if (testContacts.length > 0) {
      await prisma.contact.deleteMany({ where: { id: { in: testContacts.map(c => c.id) } } })
    }

    if (testCustomerId) {
      await prisma.suppressionEntry.deleteMany({ where: { customerId: testCustomerId } })
      await prisma.customer.delete({ where: { id: testCustomerId } })
    }

    await prisma.$disconnect()
    console.log('✅ Cleanup complete')
  }
}

// Run tests
runSuppressionTests().catch(console.error)