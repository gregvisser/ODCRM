const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const count = await prisma.customer.count();
  console.log('✅ Customers now:', count);
  await prisma.$disconnect();
})();
