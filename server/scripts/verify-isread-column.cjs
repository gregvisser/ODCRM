#!/usr/bin/env node
/**
 * Verifies that email_message_metadata.is_read exists in the database.
 * Uses DATABASE_URL from env (server/.env when run locally, or CI secrets in deploy).
 * Run from server/: node scripts/verify-isread-column.cjs
 * Exit 0 if column exists, 1 otherwise. No credentials printed.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'email_message_metadata'
        AND column_name = 'is_read'
    `;
    const exists = Array.isArray(rows) && rows.length > 0;
    if (exists) {
      console.log('COLUMN_EXISTS=yes');
      console.log('email_message_metadata.is_read: present');
    } else {
      console.log('COLUMN_EXISTS=no');
      console.log('email_message_metadata.is_read: missing');
    }
    process.exit(exists ? 0 : 1);
  } catch (err) {
    console.error('VERIFY_ERROR=', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
