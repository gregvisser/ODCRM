const { PrismaClient } = require('./server/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function checkCustomer() {
  try {
    const customerId = 'prod-customer-1';

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        leadsReportingUrl: true,
        _count: {
          select: { leadRecords: true }
        }
      }
    });

    if (customer) {
      console.log('Customer found:');
      console.log('  ID:', customer.id);
      console.log('  Name:', customer.name);
      console.log('  Leads URL:', customer.leadsReportingUrl || 'null');
      console.log('  Lead records count:', customer._count.leadRecords);
    } else {
      console.log('Customer "prod-customer-1" not found');

      // Check all customers with leadsReportingUrl
      const customersWithUrls = await prisma.customer.findMany({
        where: { leadsReportingUrl: { not: null } },
        select: {
          id: true,
          name: true,
          leadsReportingUrl: true,
          _count: {
            select: { leadRecords: true }
          }
        }
      });

      console.log('\nCustomers with leads reporting URLs:');
      customersWithUrls.forEach(cust => {
        console.log(`  ${cust.id}: ${cust.name} (${cust._count.leadRecords} leads)`);
      });
    }

    await prisma.$disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    await prisma.$disconnect();
  }
}

checkCustomer();