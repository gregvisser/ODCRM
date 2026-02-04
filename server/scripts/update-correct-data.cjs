const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres-yesterday.postgres.database.azure.com/postgres?sslmode=require'
    }
  }
});

// Data from screenshot
const updates = [
  { name: 'OCS', spend: 7000, weekTarget: 2, monthTarget: 10, defcon: 5 },
  { name: 'Panda', spend: 4700, weekTarget: 3, monthTarget: 15, defcon: 5 },
  { name: 'Thomas Franks', spend: 4500, weekTarget: 3, monthTarget: 15, defcon: 5 },
  { name: 'Be-Safe Technologies Ltd', spend: 3200, weekTarget: 3, monthTarget: 15, defcon: 4 },
  { name: 'Shield Pest Control UK', spend: 3200, weekTarget: 3, monthTarget: 15, defcon: 4 },
  { name: 'Jangro (Leicester) Ltd', spend: 3000, weekTarget: 3, monthTarget: 15, defcon: 0 },
  { name: 'LegionelaSafe Services UK Ltd', spend: 3000, weekTarget: 3, monthTarget: 15, defcon: 2 },
  { name: 'Renewable Temporary Power Ltd', spend: 3000, weekTarget: 3, monthTarget: 15, defcon: 5 },
  { name: 'Chevron Security', spend: 2600, weekTarget: 3, monthTarget: 15, defcon: 0 },
  { name: 'Octavian Security UK', spend: 1600, weekTarget: 3, monthTarget: 15, defcon: 5 },
  { name: 'Octavian IT Services', spend: 800, weekTarget: 1, monthTarget: 5, defcon: 5 },
  { name: 'Paratus365', spend: 800, weekTarget: 1, monthTarget: 5, defcon: 5 },
  { name: 'P&P Morejon FM', spend: 2000, weekTarget: 3, monthTarget: 15, defcon: 6, newName: 'P&R Morson FM' }, // Fix spelling
  { name: 'GreenTheUK Limited', spend: 2000, weekTarget: 6, monthTarget: 30, defcon: 4 },
  { name: 'Protech Roofing', spend: 2000, weekTarget: 3, monthTarget: 15, defcon: 3 },
  { name: 'Maxspace Projects', spend: 1500, weekTarget: 3, monthTarget: 15, defcon: null },
];

(async () => {
  try {
    console.log('🔄 Updating customer data from screenshot...\n');
    
    for (const update of updates) {
      const findName = update.newName ? update.name : update.name;
      const setName = update.newName || update.name;
      
      // Find customer (try exact match first, then case-insensitive)
      let customer = await prisma.$queryRaw`
        SELECT id, name FROM customers WHERE name = ${findName}
      `;
      
      if (customer.length === 0) {
        customer = await prisma.$queryRaw`
          SELECT id, name FROM customers WHERE LOWER(name) = LOWER(${findName})
        `;
      }
      
      if (customer.length === 0) {
        console.log(`❌ Customer not found: ${findName}`);
        continue;
      }
      
      const customerId = customer[0].id;
      
      // Update the customer
      await prisma.$executeRaw`
        UPDATE customers 
        SET 
          name = ${setName},
          "monthlyIntakeGBP" = ${update.spend.toString()},
          defcon = ${update.defcon},
          "weeklyLeadTarget" = ${update.weekTarget},
          "monthlyLeadTarget" = ${update.monthTarget},
          "updatedAt" = NOW()
        WHERE id = ${customerId}
      `;
      
      console.log(`✅ Updated: ${findName}${update.newName ? ` → ${setName}` : ''}`);
      console.log(`   £${update.spend}, DEFCON ${update.defcon || 'none'}, Week: ${update.weekTarget}, Month: ${update.monthTarget}`);
    }
    
    console.log('\n✅ All updates complete!');
    console.log('\nVerifying updates...\n');
    
    // Verify the updates
    const customers = await prisma.$queryRaw`
      SELECT name, "monthlyIntakeGBP", defcon, "weeklyLeadTarget", "monthlyLeadTarget"
      FROM customers
      ORDER BY name
    `;
    
    console.log('📊 Current customer data:');
    customers.forEach(c => {
      console.log(`  ${c.name}: £${c.monthlyIntakeGBP || 0}, DEFCON ${c.defcon || 'none'}, Targets: ${c.weeklyLeadTarget}/${c.monthlyLeadTarget}`);
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
