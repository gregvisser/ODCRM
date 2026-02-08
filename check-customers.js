const { PrismaClient } = require('./node_modules/@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  try {
    const customers = await prisma.customer.findMany({
      select: { id: true, name: true }
    });

    console.log('Customers:', customers);

    // Also check if there are any contacts
    const contacts = await prisma.contact.findMany({
      select: { id: true, email: true, customerId: true },
      take: 5
    });

    console.log('Sample contacts:', contacts);

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);