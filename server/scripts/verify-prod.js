#!/usr/bin/env node
/**
 * Production Verification Script
 * 
 * This script verifies that production is working correctly:
 * 1. Checks /api/health endpoint
 * 2. Creates a test record in database
 * 3. Reads it back to confirm persistence
 * 4. Cleans up test record
 * 
 * Usage:
 *   node server/scripts/verify-prod.js [--api-url=https://odcrm.bidlow.co.uk]
 */

import { PrismaClient } from '@prisma/client'

const API_URL = process.env.API_URL || process.argv.find(arg => arg.startsWith('--api-url='))?.split('=')[1] || 'https://odcrm.bidlow.co.uk'
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is required')
  console.error('   Set it in your environment or .env file')
  process.exit(1)
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
})

async function verifyHealthEndpoint() {
  console.log('🔍 Step 1: Checking /api/health endpoint...')
  try {
    const response = await fetch(`${API_URL}/api/health`)
    const data = await response.json()
    
    if (!response.ok) {
      console.error('❌ Health check failed:', data)
      return false
    }
    
    if (!data.ok || data.db !== 'ok') {
      console.error('❌ Health check reports unhealthy:', data)
      return false
    }
    
    console.log('✅ Health check passed:', {
      ok: data.ok,
      env: data.env,
      db: data.db,
      customerCount: data.database?.customerCount
    })
    return true
  } catch (error) {
    console.error('❌ Health check request failed:', error.message)
    return false
  }
}

async function verifyDatabasePersistence() {
  console.log('\n🔍 Step 2: Testing database persistence...')
  
  const testCustomerId = `verify_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const testCustomerName = `[VERIFY] Test Customer ${new Date().toISOString()}`
  
  try {
    // Create test record
    console.log('   Creating test customer record...')
    const created = await prisma.customer.create({
      data: {
        id: testCustomerId,
        name: testCustomerName,
        clientStatus: 'active',
        updatedAt: new Date(),
      }
    })
    console.log('   ✅ Created:', { id: created.id, name: created.name })
    
    // Read it back
    console.log('   Reading test customer record...')
    const read = await prisma.customer.findUnique({
      where: { id: testCustomerId }
    })
    
    if (!read) {
      console.error('   ❌ Failed to read back test record')
      return false
    }
    
    if (read.name !== testCustomerName) {
      console.error('   ❌ Data mismatch:', { expected: testCustomerName, got: read.name })
      return false
    }
    
    console.log('   ✅ Read back successfully:', { id: read.id, name: read.name })
    
    // Clean up
    console.log('   Cleaning up test record...')
    await prisma.customer.delete({
      where: { id: testCustomerId }
    })
    console.log('   ✅ Cleanup complete')
    
    return true
  } catch (error) {
    console.error('   ❌ Database persistence test failed:', error.message)
    console.error('   Stack:', error.stack)
    
    // Try to clean up on error
    try {
      await prisma.customer.deleteMany({
        where: { id: testCustomerId }
      })
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    return false
  }
}

async function verifyDatabaseConnection() {
  console.log('\n🔍 Step 3: Verifying database connection...')
  try {
    await prisma.$queryRaw`SELECT 1`
    const customerCount = await prisma.customer.count()
    console.log('✅ Database connection verified')
    console.log('   Customer count:', customerCount)
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
    return false
  }
}

async function main() {
  console.log('🚀 Production Verification Script')
  console.log('================================')
  console.log(`API URL: ${API_URL}`)
  console.log(`Database: ${DATABASE_URL ? 'configured (' + DATABASE_URL.substring(0, 30) + '...)' : 'NOT SET'}`)
  console.log('')
  
  const results = {
    health: false,
    persistence: false,
    connection: false
  }
  
  // Step 1: Health endpoint
  results.health = await verifyHealthEndpoint()
  
  // Step 2: Database connection
  results.connection = await verifyDatabaseConnection()
  
  // Step 3: Persistence test (only if connection works)
  if (results.connection) {
    results.persistence = await verifyDatabasePersistence()
  }
  
  // Summary
  console.log('\n📊 Verification Summary')
  console.log('======================')
  console.log(`Health Endpoint:     ${results.health ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Database Connection: ${results.connection ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Data Persistence:   ${results.persistence ? '✅ PASS' : '❌ FAIL'}`)
  
  const allPassed = results.health && results.connection && results.persistence
  
  if (allPassed) {
    console.log('\n✅ All checks passed! Production is healthy.')
    process.exit(0)
  } else {
    console.log('\n❌ Some checks failed. Please investigate.')
    process.exit(1)
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
