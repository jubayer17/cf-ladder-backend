import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const contestSchema = new mongoose.Schema(
  {},
  { strict: false, collection: "contests" }
);
const Contest = mongoose.model("Contest", contestSchema);

async function cleanupUnfinishedContests() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Find all contests that are NOT finished
    const unfinishedContests = await Contest.find({
      phase: { $ne: "FINISHED" },
    }).lean();

    console.log(
      `📊 Found ${unfinishedContests.length} unfinished contests in database:`
    );

    if (unfinishedContests.length > 0) {
      console.log("\n🗑️  Contests to be removed:");
      unfinishedContests.forEach((contest) => {
        console.log(
          `   - ID: ${contest.id} | Phase: ${contest.phase} | Name: ${contest.name}`
        );
      });

      // Delete unfinished contests
      const result = await Contest.deleteMany({
        phase: { $ne: "FINISHED" },
      });

      console.log(
        `\n✅ Deleted ${result.deletedCount} unfinished contests from database`
      );

      // Show final count
      const totalRemaining = await Contest.countDocuments();
      console.log(`📈 Total FINISHED contests remaining: ${totalRemaining}`);
    } else {
      console.log("✅ No unfinished contests found. Database is clean!");
    }

    await mongoose.disconnect();
    console.log("\n✅ Done!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

cleanupUnfinishedContests();
