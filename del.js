const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_VEYBSyi1o8XH@ep-square-frost-a1tuueaa-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(() => {
    return client.query("DELETE FROM competitor_insights WHERE title ILIKE '%🔴%'");
}).then(res => {
    console.log('Deleted rows:', res.rowCount);
    return client.query("DELETE FROM competitor_insights WHERE title ILIKE '%Live stream%'");
}).then(res => {
    console.log('Deleted streams rows:', res.rowCount);
}).catch(console.error).finally(() => client.end());
