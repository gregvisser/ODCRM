const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const total = await prisma.customer.count();
    console.log('Total customers:', total);
    
    const customers = await prisma.customer.groupBy({
      by: ['name'],
      _count: { name: true }
    });
    
    const unique = customers.length;
    const dupes = customers.filter(c => c._count.name > 1);
    
    console.log('Unique names:', unique);
    console.log('Duplicates:', dupes.length);
    console.log('');
    
    if (dupes.length > 0) {
      console.log('Duplicate customer names:');
      dupes.forEach(d => {
        console.log(`  ${d.name}: ${d._count.name} copies`);
      });
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
