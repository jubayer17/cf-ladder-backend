#!/usr/bin/env node
/*
 A small helper to print the highest contest `id` from the `contests` collection.
 Usage:
 1. In `backend` folder: `npm install mongodb`
 2. Run with MONGODB_URI set:
    PowerShell:  $env:MONGODB_URI="<your-uri>"; node scripts/get-latest-contest-id.js
    bash:       MONGODB_URI="<your-uri>" node scripts/get-latest-contest-id.js
 It prints the id on stdout, or `NO_CONTESTS` if collection is empty.
*/

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI environment variable is not set.');
  process.exit(2);
}

(async () => {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db();
    const contests = db.collection('contests');
    const doc = await contests.find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).next();
    if (!doc) {
      console.log('NO_CONTESTS');
      process.exit(0);
    }
    console.log(doc.id);
    process.exit(0);
  } catch (err) {
    console.error('ERROR', err.message || err);
    process.exit(3);
  } finally {
    try { await client.close(); } catch (e) {}
  }
})();
