// Quick script to verify Upstash Redis connection
require('dotenv').config({ path: '.env.local' });
const { Redis } = require('@upstash/redis');

async function testRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.error('❌ Error: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing in .env.local');
    process.exit(1);
  }

  console.log(`Connecting to Upstash Redis at: ${url}`);

  try {
    const redis = new Redis({ url, token });
    
    // Test write
    console.log('Sending test write ping...');
    await redis.set('gaptuber:test:ping', 'pong', { ex: 60 });
    console.log('✅ Write successful');

    // Test read
    console.log('Sending test read ping...');
    const val = await redis.get('gaptuber:test:ping');
    console.log(`✅ Read successful. Value: ${val}`);

    if (val === 'pong') {
      console.log('🎉 Upstash Redis integration is fully configured and working correctly!');
    } else {
      console.warn('⚠️ Warning: Read returned unexpected value:', val);
    }
  } catch (error) {
    console.error('❌ Redis test failed:', error.message);
  }

  process.exit(0);
}

testRedis();
