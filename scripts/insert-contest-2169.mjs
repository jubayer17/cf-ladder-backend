import "dotenv/config";
import axios from "axios";
import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error(
    "❌ MONGODB_URI not set in environment. Set it in backend/.env or process env."
  );
  process.exit(1);
}

// Try to reuse existing model if available (when running under ts-node/esm or built JS)
let Contest;
try {
  // prefer compiled JS model if present
  const imported = await import("../models/Contest.js");
  Contest = imported.default;
  console.log("ℹ️ Using existing model from ../models/Contest.js");
} catch (e) {
  try {
    // try TypeScript source (ts-node environment)
    const importedTs = await import("../models/Contest.ts");
    Contest = importedTs.default;
    console.log("ℹ️ Using existing model from ../models/Contest.ts");
  } catch (err) {
    // Fallback: define minimal schema matching backend/models/Contest.ts
    console.warn(
      "⚠️ Could not import existing model; falling back to local schema"
    );
    const { Schema } = mongoose;
    const ProblemSchema = new Schema(
      {
        contestId: { type: Number, required: true },
        index: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, required: true },
        rating: { type: Number },
        tags: [{ type: String }],
        points: { type: Number },
        solvedCount: { type: Number },
      },
      { _id: false }
    );

    const ContestSchema = new Schema(
      {
        id: { type: Number, required: true, unique: true, index: true },
        name: { type: String, required: true },
        type: { type: String, required: true },
        phase: { type: String, required: true, index: true },
        frozen: { type: Boolean, default: false },
        durationSeconds: { type: Number, required: true },
        startTimeSeconds: { type: Number, required: true, index: true },
        relativeTimeSeconds: { type: Number },
        problems: [ProblemSchema],
        preparedBy: { type: String },
        websiteUrl: { type: String },
        description: { type: String },
        difficulty: { type: Number },
        kind: { type: String },
        icpcRegion: { type: String },
        country: { type: String },
        city: { type: String },
        season: { type: String },
        lastSynced: { type: Date, default: Date.now },
      },
      { timestamps: true }
    );

    Contest =
      mongoose.models?.Contest || mongoose.model("Contest", ContestSchema);
  }
}

async function main() {
  await mongoose.connect(MONGO_URI, {
    maxPoolSize: 5,
    minPoolSize: 1,
    dbName: "cf-ladder",
  });
  console.log("✅ Connected to MongoDB");

  const cid = 2185;
  console.log(`🔎 Fetching contest ${cid} from Codeforces...`);
  try {
    const resp = await axios.get(
      `https://codeforces.com/api/contest.standings?contestId=${cid}&from=1&count=1`,
      { timeout: 20000 }
    );
    if (
      !(
        resp.data &&
        resp.data.status === "OK" &&
        resp.data.result &&
        resp.data.result.contest
      )
    ) {
      console.error(
        "❌ Contest not found or unexpected response from Codeforces",
        resp.data
      );
      process.exit(1);
    }

    const c = resp.data.result.contest;
    const problemsRaw = Array.isArray(resp.data.result.problems)
      ? resp.data.result.problems
      : [];

    const problems = problemsRaw
      .map((p) => ({
        contestId: cid,
        index: p.index,
        name: p.name,
        type: p.type || "PROGRAMMING",
        rating: typeof p.rating === "number" ? p.rating : undefined,
        tags: Array.isArray(p.tags) ? p.tags : [],
        points: typeof p.points === "number" ? p.points : undefined,
        solvedCount:
          typeof p.solvedCount === "number" ? p.solvedCount : undefined,
      }))
      .sort((a, b) => (a.index || "").localeCompare(b.index || ""));

    // Build contest document matching `models/Contest.ts` fields only
    const doc = {
      id: Number(c.id),
      name: String(c.name || ""),
      type: String(c.type || "CF"),
      phase: String(c.phase || "FINISHED"),
      frozen: !!c.frozen,
      durationSeconds:
        typeof c.durationSeconds === "number" ? c.durationSeconds : 0,
      startTimeSeconds:
        typeof c.startTimeSeconds === "number" ? c.startTimeSeconds : 0,
      relativeTimeSeconds:
        typeof c.relativeTimeSeconds === "number"
          ? c.relativeTimeSeconds
          : undefined,
      problems: problems,
      preparedBy: c.preparedBy || undefined,
      websiteUrl: c.websiteUrl || undefined,
      description: c.description || undefined,
      difficulty: typeof c.difficulty === "number" ? c.difficulty : undefined,
      kind: c.kind || undefined,
      icpcRegion: c.icpcRegion || undefined,
      country: c.country || undefined,
      city: c.city || undefined,
      season: c.season || undefined,
      lastSynced: new Date(),
    };

    // Upsert
    const resUpsert = await Contest.findOneAndUpdate({ id: cid }, doc, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }).lean();
    console.log("✅ Upserted contest:", resUpsert.id, resUpsert.name);

    // Update cache file
    const CACHE_FILE = path.join(process.cwd(), "cache", "contests.cache.json");
    let cache = {
      contests: [],
      problems: [],
      lastSync: 0,
      timestamp: Date.now(),
    };
    try {
      const existing = await fs.readFile(CACHE_FILE, "utf-8");
      cache = JSON.parse(existing);
    } catch (e) {
      // ignore if file missing
    }

    // Ensure contest not duplicated in cache
    cache.contests = cache.contests || [];
    cache.problems = cache.problems || [];
    if (!cache.contests.find((x) => x.id === cid)) cache.contests.push(doc);
    const newProblems = problems.filter(
      (p) =>
        !cache.problems.some(
          (pp) => pp.contestId === p.contestId && pp.index === p.index
        )
    );
    cache.problems.push(...newProblems);
    cache.lastSync = Math.floor(Date.now() / 1000);
    cache.timestamp = Date.now();

    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
    console.log("✅ Cache updated at", CACHE_FILE);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error fetching or inserting contest:", err);
    process.exit(1);
  }
}

main();
