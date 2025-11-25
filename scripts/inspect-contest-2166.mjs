import "dotenv/config";
import mongoose from "mongoose";

// Usage: node inspect-contest-2166.mjs <contestId>
// or set CONTEST_ID env var. Defaults to 2166 for backwards compatibility.

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error("MONGODB_URI not set");
  process.exit(1);
}

const argId = process.argv[2];
const envId = process.env.CONTEST_ID;
const DEFAULT_ID = 2166;
const contestId = Number(argId ?? envId ?? DEFAULT_ID);
if (!Number.isFinite(contestId) || contestId <= 0) {
  console.error(
    "Invalid contest id. Provide a positive integer as the first argument or set CONTEST_ID."
  );
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGO_URI, {
    maxPoolSize: 5,
    minPoolSize: 1,
    dbName: "cf-ladder",
  });
  const db = mongoose.connection.db;
  console.log("Connected DB name:", db.databaseName);
  const doc = await db.collection("contests").findOne({ id: contestId });
  if (!doc) {
    console.log(
      `Contest ${contestId} not found in collection 'contests' in DB ${db.databaseName}`
    );
  } else {
    console.log(`Found contest ${contestId} in DB: ${db.databaseName}`);
    console.log(
      JSON.stringify(
        {
          _id: doc._id,
          id: doc.id,
          name: doc.name,
          startTimeSeconds: doc.startTimeSeconds,
          problemsCount: Array.isArray(doc.problems) ? doc.problems.length : 0,
        },
        null,
        2
      )
    );
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
