import { PrismaClient } from '@prisma/client';

const DATABASE_URL = "postgresql://neondb_owner:npg_oqJvg13NVUBk@ep-silent-salad-ahpgcsne-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

async function main() {
  console.log('📦 Creating production customer...\n');
  
  try {
    // Check if customer already exists
    const existing = await prisma.customer.findUnique({
      where: { id: 'prod-customer-1' }
    });
    
    if (existing) {
      console.log('✅ Customer already exists:');
      console.log(`   ID: ${existing.id}`);
      console.log(`   Name: ${existing.name}`);
      console.log(`   Domain: ${existing.domain || 'none'}`);
      console.log('\n✅ Customer is ready to use!');
      return;
    }
    
    // Create customer (only required fields)
    const customer = await prisma.customer.create({
      data: {
        id: 'prod-customer-1',
        name: 'OpensDoors',
      }
    });
    
    console.log('✅ Customer created successfully!');
    console.log(`   ID: ${customer.id}`);
    console.log(`   Name: ${customer.name}`);
    console.log(`   Domain: ${customer.domain}`);
    console.log(`   Created: ${customer.createdAt}`);
    
    console.log('\n📋 Next step:');
    console.log('   Set in browser: localStorage.setItem(\'currentCustomerId\', \'prod-customer-1\')');
    
  } catch (error) {
    console.error('\n❌ Error creating customer:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
