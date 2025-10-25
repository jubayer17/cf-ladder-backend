// routes/problems.ts
import express, { Request, Response } from "express";
import axios from "axios";
import fs from "fs/promises";
import path from "path";

interface Problem {
    contestId: number;
    index: string;
    name: string;
    type?: string;
    points?: number;
    rating?: number;
    tags?: string[];
    solvedCount?: number;
    attemptCount?: number;
    acceptance?: number;
    acceptancePercent?: number | null;
    [key: string]: any;
}

const router = express.Router();

// Config (from env, with sane defaults)
const CACHE_TTL_MS = process.env.PROBLEMS_CACHE_TTL_MS
    ? parseInt(process.env.PROBLEMS_CACHE_TTL_MS, 10)
    : 1000 * 60 * 60; // 1 hour default

const CACHE_FILE_PATH =
    process.env.CACHE_FILE_PATH ||
    path.join(process.cwd(), "cache", "problems.cache.json");

const REFRESH_SECRET = process.env.PROBLEMS_REFRESH_SECRET || ""; // set this to protect refresh

// In-memory cache
let cachedProblems: Problem[] | null = null;
let cacheTimestamp = 0;

// Helpers for disk persistence
async function ensureCacheDir(filepath: string) {
    const dir = path.dirname(filepath);
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (err) {
        // ignore
    }
}

async function loadCacheFromDisk() {
    try {
        const raw = await fs.readFile(CACHE_FILE_PATH, "utf-8");
        const parsed = JSON.parse(raw) as { ts: number; problems: Problem[] } | null;
        if (parsed && Array.isArray(parsed.problems)) {
            cachedProblems = parsed.problems;
            cacheTimestamp = parsed.ts || Date.now();
            console.log(`[problems] loaded cache from disk (${cachedProblems.length} items)`);
        }
    } catch (err) {
        // file likely doesn't exist yet, that's fine
        // console.warn("[problems] no cache file or failed to read:", err);
    }
}

async function writeCacheToDisk(problems: Problem[]) {
    try {
        await ensureCacheDir(CACHE_FILE_PATH);
        await fs.writeFile(
            CACHE_FILE_PATH,
            JSON.stringify({ ts: Date.now(), problems }, null, 0),
            "utf-8"
        );
        console.log(`[problems] cache written to disk (${problems.length} items)`);
    } catch (err) {
        console.warn("[problems] failed to write cache to disk:", err);
    }
}

// Merge helper: build stats lookup and merge
function mergeProblemsWithStats(problemsRaw: any[], statsRaw: any[]): Problem[] {
    const statsMap: Record<string, any> = {};
    for (const s of statsRaw || []) {
        if (s && typeof s.contestId !== "undefined" && typeof s.index !== "undefined") {
            statsMap[`${s.contestId}-${s.index}`] = s;
        }
    }

    return (problemsRaw || []).map((p: any) => {
        const key = `${p.contestId}-${p.index}`;
        const stat = statsMap[key];
        const solvedCount = stat?.solvedCount ?? 0;
        const attemptCount = stat?.attemptCount ?? 0;
        const acceptance = solvedCount;
        const acceptancePercent =
            attemptCount && attemptCount > 0 ? Math.round((solvedCount / attemptCount) * 100) : null;

        return {
            ...p,
            tags: Array.isArray(p.tags) ? p.tags : [], // ✅ ensure array
            solvedCount,
            attemptCount,
            acceptance,
            acceptancePercent,
        } as Problem;
    });

}

// Fetch fresh data from Codeforces and update cache (used by GET miss and POST /refresh)
async function fetchAndCacheProblems(): Promise<Problem[]> {
    const cfResp = await axios.get("https://codeforces.com/api/problemset.problems", {
        timeout: 20_000,
    });

    if (!cfResp?.data?.result) throw new Error("Unexpected Codeforces response");

    const problemsRaw: any[] = cfResp.data.result.problems || [];
    const statsRaw: any[] = cfResp.data.result.problemStatistics || [];

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
router.get("/", async (req: Request, res: Response) => {
    try {
        const wantAll = req.query.all === "true";

        const now = Date.now();
        if (cachedProblems && now - cacheTimestamp < CACHE_TTL_MS) {
            res.setHeader("X-Cache", "HIT");
            res.setHeader("Cache-Control", `public, max-age=${Math.max(0, Math.floor((CACHE_TTL_MS - (now - cacheTimestamp)) / 1000))}`);
            if (wantAll) return res.json(cachedProblems);
            return res.json(cachedProblems.filter((p) => typeof p.rating === "number"));
        }

        // cache miss or expired -> attempt fetch
        try {
            const fresh = await fetchAndCacheProblems();
            res.setHeader("X-Cache", "MISS");
            res.setHeader("Cache-Control", `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`);
            if (wantAll) return res.json(fresh);
            return res.json(fresh.filter((p) => typeof p.rating === "number"));
        } catch (err) {
            console.error("[problems] fetch failed:", err);
            // if fetch failed but disk cache exists (maybe expired), serve disk cache but mark stale
            if (cachedProblems) {
                res.setHeader("X-Cache", "STALE");
                res.setHeader("Cache-Control", "public, max-age=0");
                if (wantAll) return res.json(cachedProblems);
                return res.json(cachedProblems.filter((p) => typeof p.rating === "number"));
            }

            return res.status(500).json({ message: "Error fetching problems" });
        }
    } catch (err) {
        console.error("Unexpected error in /problems:", err);
        return res.status(500).json({ message: "Internal error" });
    }
});

// POST /refresh -> force refresh cache (protected by secret)
router.post("/refresh", async (req: Request, res: Response) => {
    try {
        const provided =
            (req.headers["x-refresh-secret"] as string) || (req.query.secret as string) || req.body?.secret;
        if (REFRESH_SECRET && provided !== REFRESH_SECRET) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // fetch and replace cache
        const fresh = await fetchAndCacheProblems();
        return res.json({ ok: true, count: fresh.length });
    } catch (err) {
        console.error("[problems] refresh failed:", err);
        return res.status(500).json({ message: "Refresh failed" });
    }
});

export default router;
