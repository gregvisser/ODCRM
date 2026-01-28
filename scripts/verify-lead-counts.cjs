const { PrismaClient } = require('../server/node_modules/@prisma/client');

const prisma = new PrismaClient();

function parseDate(value) {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();

  // DD.MM.YY or DD.MM.YYYY format
  const ddmmyy = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (ddmmyy) {
    const day = parseInt(ddmmyy[1], 10);
    const month = parseInt(ddmmyy[2], 10) - 1;
    let year = parseInt(ddmmyy[3], 10);
    if (year < 100) year += 2000;
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }

  // YYYY-MM-DD format
  const yyyymmdd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (yyyymmdd) {
    const year = parseInt(yyyymmdd[1], 10);
    const month = parseInt(yyyymmdd[2], 10) - 1;
    const day = parseInt(yyyymmdd[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    if (year >= 2000 && year <= 2100) {
      return parsed;
    }
  }

  return null;
}

async function verifyLeadCounts() {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Current week: Monday -> next Monday (exclusive)
    const currentWeekStart = new Date(startOfToday);
    const day = currentWeekStart.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    currentWeekStart.setDate(currentWeekStart.getDate() + diff);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    console.log('\n=== DATE RANGES ===');
    console.log(`Today: ${startOfToday.toISOString()}`);
    console.log(`Current Week: ${currentWeekStart.toISOString()} to ${currentWeekEnd.toISOString()}`);
    console.log(`Current Month: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);

    const customers = await prisma.customer.findMany({
      where: { leadsReportingUrl: { not: null } },
      select: {
        name: true,
        weeklyLeadTarget: true,
        weeklyLeadActual: true,
        monthlyLeadTarget: true,
        monthlyLeadActual: true,
      },
      orderBy: { name: 'asc' }
    });

    console.log('\n=== RECALCULATING LEAD COUNTS ===\n');

    for (const customer of customers) {
      const leadRecords = await prisma.leadRecord.findMany({
        where: { accountName: customer.name }
      });

      let weeklyCount = 0;
      let monthlyCount = 0;
      let leadsWithDates = 0;
      let leadsWithoutDates = 0;

      leadRecords.forEach(record => {
        const lead = record.data;
        
        // Try to find a date field
        let dateValue = lead.Date || lead.date || lead.Week || lead.week || lead['First Meeting Date'] || '';
        
        if (!dateValue) {
          // Look for any field that looks like a date
          for (const key of Object.keys(lead)) {
            const value = lead[key] || '';
            if (value && value.trim() && /^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(value.trim())) {
              dateValue = value.trim();
              break;
            }
          }
        }

        const parsedDate = parseDate(dateValue);
        
        if (parsedDate) {
          leadsWithDates++;
          
          if (parsedDate >= currentWeekStart && parsedDate < currentWeekEnd) {
            weeklyCount++;
          }
          
          if (parsedDate >= monthStart && parsedDate < monthEnd) {
            monthlyCount++;
          }
        } else {
          leadsWithoutDates++;
        }
      });

      console.log(`${customer.name}:`);
      console.log(`  Total Leads: ${leadRecords.length}`);
      console.log(`  Leads with dates: ${leadsWithDates}`);
      console.log(`  Leads without dates: ${leadsWithoutDates}`);
      console.log(`  Weekly Count (calculated): ${weeklyCount} | DB: ${customer.weeklyLeadActual} | Target: ${customer.weeklyLeadTarget}`);
      console.log(`  Monthly Count (calculated): ${monthlyCount} | DB: ${customer.monthlyLeadActual} | Target: ${customer.monthlyLeadTarget}`);
      
      if (weeklyCount !== customer.weeklyLeadActual || monthlyCount !== customer.monthlyLeadActual) {
        console.log(`  ⚠️  MISMATCH DETECTED!`);
      }
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyLeadCounts();
