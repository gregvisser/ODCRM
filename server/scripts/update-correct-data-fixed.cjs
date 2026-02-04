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
  { search: 'OCS', spend: 7000, weekTarget: 2, monthTarget: 10, defcon: 5 },
  { search: 'Panda', spend: 4700, weekTarget: 3, monthTarget: 15, defcon: 5 },
  { search: 'Thomas Franks', spend: 4500, weekTarget: 3, monthTarget: 15, defcon: 5 },
  { search: 'Be-Safe', spend: 3200, weekTarget: 3, monthTarget: 15, defcon: 4 },
  { search: 'Shield Pest Control', spend: 3200, weekTarget: 3, monthTarget: 15, defcon: 4 },
  { search: 'Jangro', spend: 3000, weekTarget: 3, monthTarget: 15, defcon: 0 },
  { search: 'Legionela', spend: 3000, weekTarget: 3, monthTarget: 15, defcon: 2 },
  { search: 'Renewable', spend: 3000, weekTarget: 3, monthTarget: 15, defcon: 5 },
  { search: 'Chevron', spend: 2600, weekTarget: 3, monthTarget: 15, defcon: 0 },
  { search: 'Octavian Security', spend: 1600, weekTarget: 3, monthTarget: 15, defcon: 5 },
  { search: 'Octavian IT', spend: 800, weekTarget: 1, monthTarget: 5, defcon: 5 },
  { search: 'Paratus', spend: 800, weekTarget: 1, monthTarget: 5, defcon: 5 },
  { search: 'Morejon', newName: 'P&R Morson FM', spend: 2000, weekTarget: 3, monthTarget: 15, defcon: 6 },
  { search: 'GreenTheUK', spend: 2000, weekTarget: 6, monthTarget: 30, defcon: 4 },
  { search: 'Protech', spend: 2000, weekTarget: 3, monthTarget: 15, defcon: 3 },
  { search: 'Maxspace', spend: 1500, weekTarget: 3, monthTarget: 15, defcon: null },
];

(async () => {
  try {
    console.log('🔄 Updating customer data from screenshot...\n');
    
    // First, list all customers
    const allCustomers = await prisma.$queryRaw`
      SELECT id, name FROM customers ORDER BY name
    `;
    console.log('📋 Existing customers:');
    allCustomers.forEach(c => console.log(`  - ${c.name}`));
    console.log('');
    
    for (const update of updates) {
      // Find customer by partial name match
      const customer = allCustomers.find(c => 
        c.name.toLowerCase().includes(update.search.toLowerCase())
      );
      
      if (!customer) {
        console.log(`❌ Customer not found for: ${update.search}`);
        continue;
      }
      
      const customerId = customer.id;
      const setName = update.newName || customer.name;
      
      // Update the customer with proper type casting
      await prisma.$executeRaw`
        UPDATE customers 
        SET 
          name = ${setName},
          "monthlyIntakeGBP" = ${update.spend}::numeric,
          defcon = ${update.defcon},
          "weeklyLeadTarget" = ${update.weekTarget},
          "monthlyLeadTarget" = ${update.monthTarget},
          "updatedAt" = NOW()
        WHERE id = ${customerId}
      `;
      
      console.log(`✅ Updated: ${customer.name}${update.newName ? ` → ${setName}` : ''}`);
      console.log(`   £${update.spend}, DEFCON ${update.defcon !== null ? update.defcon : 'none'}, Week: ${update.weekTarget}, Month: ${update.monthTarget}`);
    }
    
    console.log('\n✅ All updates complete!');
    console.log('\nVerifying updates...\n');
    
    // Verify the updates
    const customers = await prisma.$queryRaw`
      SELECT name, "monthlyIntakeGBP", defcon, "weeklyLeadTarget", "monthlyLeadTarget"
      FROM customers
      ORDER BY name
    `;
    
    console.log('📊 Updated customer data:');
    customers.forEach(c => {
      console.log(`  ${c.name}: £${c.monthlyIntakeGBP || 0}, DEFCON ${c.defcon !== null ? c.defcon : 'none'}, Targets: ${c.weeklyLeadTarget}/${c.monthlyLeadTarget}`);
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
