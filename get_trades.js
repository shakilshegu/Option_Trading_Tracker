const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const trades = await db.collection('trades').find().sort({createdAt: -1}).limit(2).toArray();
    console.log(JSON.stringify(trades, null, 2));
  } finally {
    await client.close();
  }
}
run().catch(console.error);
