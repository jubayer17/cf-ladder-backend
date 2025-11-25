"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/problems.ts
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const router = express_1.default.Router();
// Config (from env, with sane defaults)
const CACHE_TTL_MS = process.env.PROBLEMS_CACHE_TTL_MS
    ? parseInt(process.env.PROBLEMS_CACHE_TTL_MS, 10)
    : 1000 * 60 * 60; // 1 hour default
const CACHE_FILE_PATH = process.env.CACHE_FILE_PATH ||
    path_1.default.join(process.cwd(), "cache", "problems.cache.json");
const REFRESH_SECRET = process.env.PROBLEMS_REFRESH_SECRET || ""; // set this to protect refresh
// In-memory cache
let cachedProblems = null;
let cacheTimestamp = 0;
// Helpers for disk persistence
async function ensureCacheDir(filepath) {
    const dir = path_1.default.dirname(filepath);
    try {
        await promises_1.default.mkdir(dir, { recursive: true });
    }
    catch (err) {
        // ignore
    }
}
async function loadCacheFromDisk() {
    try {
        const raw = await promises_1.default.readFile(CACHE_FILE_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.problems)) {
            cachedProblems = parsed.problems;
            cacheTimestamp = parsed.ts || Date.now();
            console.log(`[problems] loaded cache from disk (${cachedProblems.length} items)`);
        }
    }
    catch (err) {
        // file likely doesn't exist yet, that's fine
        // console.warn("[problems] no cache file or failed to read:", err);
    }
}
async function writeCacheToDisk(problems) {
    try {
        await ensureCacheDir(CACHE_FILE_PATH);
        await promises_1.default.writeFile(CACHE_FILE_PATH, JSON.stringify({ ts: Date.now(), problems }, null, 0), "utf-8");
        console.log(`[problems] cache written to disk (${problems.length} items)`);
    }
    catch (err) {
        console.warn("[problems] failed to write cache to disk:", err);
    }
}
// Merge helper: build stats lookup and merge
function mergeProblemsWithStats(problemsRaw, statsRaw) {
    const statsMap = {};
    for (const s of statsRaw || []) {
        if (s && typeof s.contestId !== "undefined" && typeof s.index !== "undefined") {
            statsMap[`${s.contestId}-${s.index}`] = s;
        }
    }
    return (problemsRaw || []).map((p) => {
        const key = `${p.contestId}-${p.index}`;
        const stat = statsMap[key];
        const solvedCount = stat?.solvedCount ?? 0;
        const attemptCount = stat?.attemptCount ?? 0;
        const acceptance = solvedCount;
        const acceptancePercent = attemptCount && attemptCount > 0 ? Math.round((solvedCount / attemptCount) * 100) : null;
        return {
            ...p,
            tags: Array.isArray(p.tags) ? p.tags : [], // ✅ ensure array
            solvedCount,
            attemptCount,
            acceptance,
            acceptancePercent,
        };
    });
}
// Fetch fresh data from Codeforces and update cache (used by GET miss and POST /refresh)
async function fetchAndCacheProblems() {
    const cfResp = await axios_1.default.get("https://codeforces.com/api/problemset.problems", {
        timeout: 20000,
    });
    if (!cfResp?.data?.result)
        throw new Error("Unexpected Codeforces response");
    const problemsRaw = cfResp.data.result.problems || [];
    const statsRaw = cfResp.data.result.problemStatistics || [];
    const merged = mergeProblemsWithStats(problemsRaw, statsRaw);
    // update in-memory and disk
    cachedProblems = merged;
    cacheTimestamp = Date.now();
    await writeCacheToDisk(merged);
    return merged;
}
// Load cache from disk at startup (best-effort)
loadCacheFromDisk().catch((e) => {
    console.warn("[problems] startup cache load failed:", e);
});
// GET / -> serve cached (if fresh) or fetch and return
router.get("/", async (req, res) => {
    try {
        const wantAll = req.query.all === "true";
        const now = Date.now();
        if (cachedProblems && now - cacheTimestamp < CACHE_TTL_MS) {
            res.setHeader("X-Cache", "HIT");
            res.setHeader("Cache-Control", `public, max-age=${Math.max(0, Math.floor((CACHE_TTL_MS - (now - cacheTimestamp)) / 1000))}`);
            if (wantAll)
                return res.json(cachedProblems);
            return res.json(cachedProblems.filter((p) => typeof p.rating === "number"));
        }
        // cache miss or expired -> attempt fetch
        try {
            const fresh = await fetchAndCacheProblems();
            res.setHeader("X-Cache", "MISS");
            res.setHeader("Cache-Control", `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`);
            if (wantAll)
                return res.json(fresh);
            return res.json(fresh.filter((p) => typeof p.rating === "number"));
        }
        catch (err) {
            console.error("[problems] fetch failed:", err);
            // if fetch failed but disk cache exists (maybe expired), serve disk cache but mark stale
            if (cachedProblems) {
                res.setHeader("X-Cache", "STALE");
                res.setHeader("Cache-Control", "public, max-age=0");
                if (wantAll)
                    return res.json(cachedProblems);
                return res.json(cachedProblems.filter((p) => typeof p.rating === "number"));
            }
            return res.status(500).json({ message: "Error fetching problems" });
        }
    }
    catch (err) {
        console.error("Unexpected error in /problems:", err);
        return res.status(500).json({ message: "Internal error" });
    }
});
// POST /refresh -> force refresh cache (protected by secret)
router.post("/refresh", async (req, res) => {
    try {
        const provided = req.headers["x-refresh-secret"] || req.query.secret || req.body?.secret;
        if (REFRESH_SECRET && provided !== REFRESH_SECRET) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        // fetch and replace cache
        const fresh = await fetchAndCacheProblems();
        return res.json({ ok: true, count: fresh.length });
    }
    catch (err) {
        console.error("[problems] refresh failed:", err);
        return res.status(500).json({ message: "Refresh failed" });
    }
});
exports.default = router;
//# sourceMappingURL=problems.js.map