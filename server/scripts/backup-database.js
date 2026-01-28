/**
 * Automated Database Backup Script
 * 
 * Creates daily JSON backups of all critical database tables.
 * Automatically cleans up backups older than 30 days.
 * 
 * Usage:
 *   npm run backup
 * 
 * Or schedule daily:
 *   - Windows Task Scheduler
 *   - Cron job (Linux/Mac)
 *   - GitHub Actions workflow
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backupDatabase() {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0]; // YYYY-MM-DD
  const backupDir = path.join(__dirname, '../backups');
  
  console.log('🔄 Starting database backup...');
  console.log(`Timestamp: ${timestamp}`);
  
  // Create backup directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`✅ Created backup directory: ${backupDir}`);
  }
  
  try {
    // Fetch all critical data
    console.log('📊 Fetching data from database...');
    
    const [
      customers,
      contacts,
      campaigns,
      templates,
      sequences,
      contactLists,
      suppressionEntries
    ] = await Promise.all([
      prisma.customer.findMany(),
      prisma.customerContact.findMany(),
      prisma.emailCampaign.findMany(),
      prisma.emailTemplate.findMany(),
      prisma.emailSequence.findMany(),
      prisma.contactList.findMany(),
      prisma.suppressionEntry.findMany()
    ]);
    
    const counts = {
      customers: customers.length,
      contacts: contacts.length,
      campaigns: campaigns.length,
      templates: templates.length,
      sequences: sequences.length,
      contactLists: contactLists.length,
      suppressionEntries: suppressionEntries.length
    };
    
    console.log('📦 Records fetched:');
    Object.entries(counts).forEach(([table, count]) => {
      console.log(`   - ${table}: ${count}`);
    });
    
    // Create backup object
    const backup = {
      metadata: {
        timestamp,
        date,
        version: '1.0',
        tables: Object.keys(counts),
        counts
      },
      data: {
        customers,
        contacts,
        campaigns,
        templates,
        sequences,
        contactLists,
        suppressionEntries
      }
    };
    
    // Write backup file
    const filename = `backup-${date}.json`;
    const filepath = path.join(backupDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
    
    const stats = fs.statSync(filepath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`✅ Backup created successfully`);
    console.log(`   File: ${filename}`);
    console.log(`   Size: ${sizeMB} MB`);
    console.log(`   Path: ${filepath}`);
    
    // Clean up old backups (keep last 30 days)
    console.log('🗑️  Cleaning up old backups...');
    const files = fs.readdirSync(backupDir);
    const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.json'));
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let deletedCount = 0;
    backupFiles.forEach(file => {
      const match = file.match(/backup-(\d{4}-\d{2}-\d{2})\.json/);
      if (!match) return;
      
      const fileDate = new Date(match[1]);
      if (fileDate < thirtyDaysAgo) {
        const oldFilePath = path.join(backupDir, file);
        fs.unlinkSync(oldFilePath);
        console.log(`   Deleted: ${file}`);
        deletedCount++;
      }
    });
    
    if (deletedCount === 0) {
      console.log('   No old backups to delete');
    } else {
      console.log(`   Deleted ${deletedCount} old backup(s)`);
    }
    
    console.log('✅ Backup complete!');
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run backup
backupDatabase()
  .then(() => {
    console.log('✅ Backup script finished successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Backup script failed:', error.message);
    process.exit(1);
  });
