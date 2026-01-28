const { PrismaClient } = require('../server/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function checkLeadsSystem() {
  try {
    console.log('\n=== 1. CUSTOMERS WITH GOOGLE SHEETS ===\n');
    const customers = await prisma.customer.findMany({
      where: {
        leadsReportingUrl: { not: null }
      },
      select: {
        id: true,
        name: true,
        leadsReportingUrl: true,
        weeklyLeadTarget: true,
        weeklyLeadActual: true,
        monthlyLeadTarget: true,
        monthlyLeadActual: true
      },
      orderBy: { name: 'asc' }
    });

    console.log(`Found ${customers.length} customers with Google Sheets URLs:\n`);
    customers.forEach(c => {
      console.log(`- ${c.name}`);
      console.log(`  URL: ${c.leadsReportingUrl?.substring(0, 80)}...`);
      console.log(`  Weekly: ${c.weeklyLeadActual || 0}/${c.weeklyLeadTarget || 0}`);
      console.log(`  Monthly: ${c.monthlyLeadActual || 0}/${c.monthlyLeadTarget || 0}\n`);
    });

    console.log('\n=== 2. LEAD RECORDS IN DATABASE ===\n');
    const leadRecords = await prisma.leadRecord.groupBy({
      by: ['accountName'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });

    console.log(`Total accounts with leads: ${leadRecords.length}\n`);
    leadRecords.forEach(record => {
      console.log(`- ${record.accountName}: ${record._count.id} leads`);
    });

    console.log('\n=== 3. LEAD SYNC STATE ===\n');
    const syncStates = await prisma.leadSyncState.findMany({
      include: {
        customer: {
          select: { name: true }
        }
      },
      orderBy: { lastSyncAt: 'desc' }
    });

    syncStates.forEach(state => {
      console.log(`- ${state.customer.name}`);
      console.log(`  Last Sync: ${state.lastSyncAt}`);
      console.log(`  Last Success: ${state.lastSuccessAt || 'Never'}`);
      console.log(`  Row Count: ${state.rowCount || 0}`);
      console.log(`  Last Error: ${state.lastError || 'None'}\n`);
    });

    console.log('\n=== 4. SAMPLE LEADS FROM PARATUS (First 3) ===\n');
    const paratusLeads = await prisma.leadRecord.findMany({
      where: { accountName: 'Paratus365' },
      take: 3,
      orderBy: { updatedAt: 'desc' }
    });

    paratusLeads.forEach((lead, i) => {
      console.log(`Lead ${i + 1}:`);
      console.log(JSON.stringify(lead.data, null, 2));
      console.log('');
    });

    console.log('\n=== 5. ALL CUSTOMERS (WITH AND WITHOUT SHEETS) ===\n');
    const allCustomers = await prisma.customer.findMany({
      select: {
        name: true,
        leadsReportingUrl: true
      },
      orderBy: { name: 'asc' }
    });

    console.log(`Total customers: ${allCustomers.length}\n`);
    allCustomers.forEach(c => {
      const hasUrl = c.leadsReportingUrl ? '✓ HAS URL' : '✗ NO URL';
      console.log(`- ${c.name}: ${hasUrl}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLeadsSystem();
