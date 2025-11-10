// Test the /api/contests/sync endpoint
import fetch from "node-fetch";

const BACKEND_API = "http://localhost:4000";

async function testSync() {
  console.log("🧪 Testing /api/contests/sync endpoint...\n");

  try {
    console.log("📡 Calling POST /api/contests/sync...");
    console.log("⏳ This may take a while (fetching from Codeforces API)...\n");

    const response = await fetch(`${BACKEND_API}/api/contests/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log("✅ Sync completed successfully!\n");
    console.log("📊 Results:");
    console.log(`  • New contests inserted: ${data.contestsInserted}`);
    console.log(`  • Existing contests updated: ${data.contestsUpdated}`);
    console.log(`  • Total problems: ${data.totalProblems}`);
    console.log(`  • Success: ${data.success}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

testSync();
