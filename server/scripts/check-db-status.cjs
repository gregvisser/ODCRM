const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const customers = await prisma.customer.count();
    const contacts = await prisma.customerContact.count();
    const leads = await prisma.lead.count();
    
    console.log('📊 DATABASE STATUS:');
    console.log('Customers:', customers);
    console.log('Contacts:', contacts);
    console.log('Leads:', leads);
    console.log('');
    
    // Show customer details with data
    const customersWithData = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        monthlyIntakeGBP: true,
        defcon: true,
        _count: {
          select: {
            customerContacts: true,
            leads: true
          }
        }
      }
    });
    
    console.log('📋 CUSTOMERS WITH DATA:');
    customersWithData.forEach(c => {
      const hasData = c.monthlyIntakeGBP || c.defcon;
      if (hasData || c._count.customerContacts > 0 || c._count.leads > 0) {
        console.log(`${c.name}:`);
        console.log(`  Revenue: £${c.monthlyIntakeGBP || 0}`);
        console.log(`  DEFCON: ${c.defcon || 'none'}`);
        console.log(`  Contacts: ${c._count.customerContacts}`);
        console.log(`  Leads: ${c._count.leads}`);
      }
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
