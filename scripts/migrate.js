// Quick migration script to add analytics column
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    await sql`ALTER TABLE scans ADD COLUMN IF NOT EXISTS analytics JSONB;`;
    console.log('✅ Migration successful: analytics column added');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
  
  process.exit(0);
}

migrate();
