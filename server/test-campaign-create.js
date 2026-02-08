// Test script to verify campaign creation without id injection
// Run with: node test-campaign-create.js

import { PrismaClient } from './node_modules/@prisma/client/index.js'

const prisma = new PrismaClient()

async function testCampaignCreate() {
  try {
    console.log('🧪 Testing campaign creation...')

    // Create test customer if needed
    let customer = await prisma.customer.findFirst()
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          id: 'test-customer-123',
          name: 'Test Customer',
        }
      })
      console.log('✅ Created test customer')
    }

    // Test data - simulate what frontend sends
    const testData = {
      name: 'Test Campaign',
      description: 'Created by test script',
      status: 'draft',
      senderIdentityId: null,
      listId: null,
      sequenceId: null,
      sendWindowHoursStart: 9,
      sendWindowHoursEnd: 17,
      randomizeWithinHours: 24,
      followUpDelayDaysMin: 3,
      followUpDelayDaysMax: 5,
    }

    console.log('📤 Sending create request with data:', testData)

    // Simulate the handler logic
    const dataForCreate = {
      name: testData.name,
      description: testData.description,
      status: testData.status,
      senderIdentityId: testData.senderIdentityId,
      sendWindowHoursStart: testData.sendWindowHoursStart,
      sendWindowHoursEnd: testData.sendWindowHoursEnd,
      randomizeWithinHours: testData.randomizeWithinHours,
      followUpDelayDaysMin: testData.followUpDelayDaysMin,
      followUpDelayDaysMax: testData.followUpDelayDaysMax,
      customerId: customer.id,
      ...(testData.listId ? { listId: testData.listId } : {}),
      ...(testData.sequenceId ? { sequenceId: testData.sequenceId } : {}),
    }

    // Check for id field
    if ('id' in dataForCreate) {
      throw new Error('Security violation: id field found in create payload')
    }

    console.log('✅ No id field in dataForCreate')
    console.log('📦 Final create payload:', dataForCreate)

    // Create the campaign
    const campaign = await prisma.emailCampaign.create({
      data: dataForCreate,
      include: {
        senderIdentity: true
      }
    })

    console.log('✅ Campaign created successfully:', {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      customerId: campaign.customerId,
    })

    // Clean up
    await prisma.emailCampaign.delete({
      where: { id: campaign.id }
    })
    console.log('🧹 Cleaned up test campaign')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testCampaignCreate()