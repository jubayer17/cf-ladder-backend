import "dotenv/config";
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error("MONGODB_URI not set");
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
  const doc = await db.collection("contests").findOne({ id: 2169 });
  if (!doc) {
    console.log(
      "Contest 2169 not found in collection `contests` in DB",
      db.databaseName
    );
  } else {
    console.log("Found contest in DB:", db.databaseName);
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
