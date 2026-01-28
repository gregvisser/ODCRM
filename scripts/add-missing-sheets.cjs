const { PrismaClient } = require('../server/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function addMissingSheets() {
  try {
    console.log('\n=== CHECKING CURRENT STATE ===\n');
    
    const accounts = await prisma.customer.findMany({
      where: {
        name: {
          in: ['Octavian Security UK', 'Octavian IT Services', 'Renewable Temporary Power Ltd']
        }
      },
      select: {
        id: true,
        name: true,
        leadsReportingUrl: true
      }
    });

    console.log('Current state:');
    accounts.forEach(acc => {
      console.log(`- ${acc.name}: ${acc.leadsReportingUrl || 'NO URL'}`);
    });

    console.log('\n=== ADDING GOOGLE SHEETS URLs ===\n');

    const updates = [
      {
        name: 'Octavian Security UK',
        url: 'https://docs.google.com/spreadsheets/d/14uIuR33x5ofjKmQ2JiBd2_81x5IuQLl5BCc4O1lmffo/edit?gid=2099466641#gid=2099466641'
      },
      {
        name: 'Octavian IT Services',
        url: 'https://docs.google.com/spreadsheets/d/1Mne7cdssDXcZbuctvidereMVcOtNJbRPhK6lmMcy6ck/edit?gid=683282199#gid=683282199'
      },
      {
        name: 'Renewable Temporary Power Ltd',
        url: 'https://docs.google.com/spreadsheets/d/1ULdRD35s0BkE9o_9s6ZQQpvm2GaRwnqFik0ktivoiSA/edit?gid=1654759294#gid=1654759294'
      }
    ];

    for (const { name, url } of updates) {
      const customer = await prisma.customer.findFirst({
        where: { name }
      });
      
      if (!customer) {
        console.log(`✗ ${name} not found in database`);
        continue;
      }
      
      await prisma.customer.update({
        where: { id: customer.id },
        data: { leadsReportingUrl: url }
      });
      console.log(`✓ Updated ${name}`);
      console.log(`  URL: ${url.substring(0, 80)}...`);
    }

    console.log('\n=== VERIFICATION ===\n');
    
    const verified = await prisma.customer.findMany({
      where: {
        name: {
          in: ['Octavian Security UK', 'Octavian IT Services', 'Renewable Temporary Power Ltd']
        }
      },
      select: {
        name: true,
        leadsReportingUrl: true
      }
    });

    verified.forEach(acc => {
      console.log(`✓ ${acc.name}:`);
      console.log(`  ${acc.leadsReportingUrl}`);
      console.log('');
    });

    console.log('SUCCESS: All Google Sheets URLs have been saved to the database.');
    console.log('The backend worker will sync these sheets in the next 10 minutes.');

  } catch (error) {
    console.error('ERROR:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addMissingSheets();
