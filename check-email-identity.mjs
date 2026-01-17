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
  console.log('🔍 Checking email identities in database...\n');
  
  try {
    const identities = await prisma.email_identities.findMany({
      where: {
        customerId: 'prod-customer-1'
      }
    });
    
    console.log(`Found ${identities.length} email identities for prod-customer-1:`);
    identities.forEach(identity => {
      console.log(`  - ${identity.emailAddress} (${identity.displayName || 'No display name'})`);
      console.log(`    ID: ${identity.id}`);
      console.log(`    Active: ${identity.isActive}`);
      console.log(`    Created: ${identity.createdAt}`);
    });
    
    if (identities.length === 0) {
      console.log('\n❌ No email identities found!');
      console.log('OAuth may have failed to save.');
    } else {
      console.log('\n✅ Email identities exist in database!');
      console.log('Frontend should be able to fetch them.');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
