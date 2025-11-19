import express from 'express';
import axios from 'axios';
import mongoose from 'mongoose';
import Contest from '../models/Contest.js';
import fs from 'fs/promises';
import path from 'path';
import pLimit from 'p-limit';
const router = express.Router();
const limit = pLimit(5);
const CACHE_FILE = path.join(process.cwd(), 'cache', 'contests.cache.json');
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
const problemsByContest = new Map<number, CFProblem[]>();
interface CFContest {
    id: number;
    name: string;
    type: string;
    phase: string;
    frozen: boolean;
    durationSeconds: number;
    startTimeSeconds?: number;
    relativeTimeSeconds?: number;
    preparedBy?: string;
    websiteUrl?: string;
    description?: string;
    difficulty?: number;
    kind?: string;
    icpcRegion?: string;
    country?: string;
    city?: string;
    season?: string;
}

interface CFProblem {
    contestId: number;
    index: string;
    name: string;
    type: string;
    points?: number;
    rating?: number;
    tags: string[];
}

interface ProblemsetResponse {
    status: string;
    result: {
        problems: CFProblem[];
        problemStatistics: any[];
    };
}

// Sync contests from Codeforces API to MongoDB
router.post('/sync', async (req, res) => {
    try {
        // Check MongoDB connection first
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            console.error('❌ MongoDB not connected, state:', mongoose.connection?.readyState);
            return res.status(503).json({
                success: false,
                error: 'Database connection not available',
                dbState: mongoose.connection?.readyState
            });
        }

        console.log('🔄 Starting incremental contest sync from Codeforces...');

        // Step 1: Get the latest contest by startTimeSeconds (most recent time)
        const latestContest = await Contest.findOne()
            .sort({ startTimeSeconds: -1 })
            .select('startTimeSeconds id')
            .lean();

        const latestTime = latestContest?.startTimeSeconds || 0;
        console.log(`📊 Latest contest in database: ID=${latestContest?.id}, startTime=${latestTime} (${new Date(latestTime * 1000).toISOString()})`);

        // Step 2 (incremental): Probe Codeforces for contests with IDs greater than
        // the highest contest ID we have in the database. This avoids fetching the
        // entire contest list and inserts only truly new contests.
        console.log('📥 Probing Codeforces for new contests by ID...');

        // Highest contest ID already in DB
        const highestContest = await Contest.findOne().sort({ id: -1 }).select('id startTimeSeconds').lean();
        const highestId = highestContest?.id || 0;
        console.log(`🔎 Highest contest ID in DB: ${highestId}`);

        const MAX_CONSECUTIVE_MISSES = 10; // stop after this many consecutive missing IDs (reduced as requested)
        const MAX_PROBES = 5000; // upper cap to avoid infinite loops

        let consecutiveMisses = 0;
        let probes = 0;
        const discoveredContests: CFContest[] = [];
        const discoveredProblems = new Map<number, CFProblem[]>();

        // Probe sequentially starting from next ID
        for (let cid = highestId + 1; consecutiveMisses < MAX_CONSECUTIVE_MISSES && probes < MAX_PROBES; cid++) {
            probes++;
            try {
                console.log(`Probing contest ID ${cid}...`);
                const resp = await axios.get(
                    `https://codeforces.com/api/contest.standings?contestId=${cid}&from=1&count=1`,
                    { timeout: 20000 }
                );

                if (resp.data && resp.data.status === 'OK' && resp.data.result && resp.data.result.contest) {
                    const c = resp.data.result.contest as any;
                    const problemsRaw = Array.isArray(resp.data.result.problems) ? resp.data.result.problems : [];
                    const problemsArr: CFProblem[] = problemsRaw.map((p: any) => ({
                        contestId: cid,
                        index: p.index,
                        name: p.name,
                        type: p.type || 'PROGRAMMING',
                        rating: p.rating,
                        tags: p.tags || [],
                        points: p.points
                    }));

                    const contestObj: CFContest = {
                        id: c.id,
                        name: c.name,
                        type: c.type || 'PROGRAMMING',
                        phase: c.phase || 'FINISHED',
                        frozen: !!c.frozen,
                        durationSeconds: c.durationSeconds || 0,
                        startTimeSeconds: c.startTimeSeconds,
                        relativeTimeSeconds: c.relativeTimeSeconds,
                        preparedBy: c.preparedBy,
                        websiteUrl: c.websiteUrl,
                        description: c.description,
                        difficulty: c.difficulty,
                        kind: c.kind,
                        icpcRegion: c.icpcRegion,
                        country: c.country,
                        city: c.city,
                        season: c.season
                    };

                    // Only consider finished contests and those with a start time
                    if (contestObj.phase === 'FINISHED' && typeof contestObj.startTimeSeconds === 'number') {
                        discoveredContests.push(contestObj);
                        discoveredProblems.set(cid, problemsArr);
                        consecutiveMisses = 0; // reset on found
                        console.log(`  → Found contest ${cid} (${contestObj.name}) with ${problemsArr.length} problems`);
                    } else {
                        consecutiveMisses++;
                    }
                } else {
                    consecutiveMisses++;
                }
            } catch (err: any) {
                // Many IDs will not exist — count as a miss and continue
                consecutiveMisses++;
                console.warn(`  × no contest at ID ${cid} (${err?.message || 'no response'})`);
            }
        }

        console.log(`📊 Probing complete. Discovered ${discoveredContests.length} new candidate contests after probing ${probes} IDs`);

        // Early exit if nothing discovered
        if (discoveredContests.length === 0) {
            console.log('✅ Already up to date - no new contests found via ID probing');
            return res.json({
                success: true,
                contestsInserted: 0,
                contestsUpdated: 0,
                totalProblems: 0,
                message: 'Already up to date'
            });
        }

        // Use discovered lists for insertion
        const newContests = discoveredContests;
        const problemsByContest = discoveredProblems;

        let contestsInserted = 0;
        let contestsUpdated = 0;

        // Step 5: Insert or update only NEW contests with their problems
        const contestsToInsert = [];

        for (const contest of newContests) {
            const contestProblems = problemsByContest.get(contest.id) || [];

            // Sort problems by index (A, B, C, D, E, etc.)
            contestProblems.sort((a, b) => {
                const indexA = a.index || '';
                const indexB = b.index || '';
                return indexA.localeCompare(indexB);
            });

            const contestData = {
                id: contest.id,
                name: contest.name,
                type: contest.type,
                phase: contest.phase,
                frozen: contest.frozen,
                durationSeconds: contest.durationSeconds,
                startTimeSeconds: contest.startTimeSeconds || 0,
                relativeTimeSeconds: contest.relativeTimeSeconds,
                problems: contestProblems.map(p => ({
                    contestId: p.contestId,
                    index: p.index,
                    name: p.name,
                    type: p.type,
                    rating: p.rating,
                    tags: p.tags || [],
                    points: p.points
                })),
                preparedBy: contest.preparedBy,
                websiteUrl: contest.websiteUrl,
                description: contest.description,
                difficulty: contest.difficulty,
                kind: contest.kind,
                icpcRegion: contest.icpcRegion,
                country: contest.country,
                city: contest.city,
                season: contest.season,
                lastSynced: new Date()
            };

            // Check if contest exists (shouldn't happen, but safety check)
            const existing = await Contest.findOne({ id: contest.id });
            if (existing) {
                await Contest.updateOne({ id: contest.id }, contestData);
                contestsUpdated++;
            } else {
                contestsToInsert.push(contestData);
            }
        }

        // Batch insert new contests for better performance
        if (contestsToInsert.length > 0) {
            await Contest.insertMany(contestsToInsert);
            contestsInserted = contestsToInsert.length;
        }

        // Save to cache file (only new contests)
        await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
        await fs.writeFile(CACHE_FILE, JSON.stringify({
            contests: newContests,
            problems: Array.from(problemsByContest.values()).flat(),
            lastSync: Math.floor(Date.now() / 1000),
            timestamp: Date.now()
        }));

        console.log(`✅ Synced ${contestsInserted} new contests and updated ${contestsUpdated} contests (${newContests.length} total processed)`);

        res.json({
            success: true,
            contestsInserted,
            contestsUpdated,
            totalProblems: Array.from(problemsByContest.values()).flat().length,
            newContestsCount: newContests.length
        });
    } catch (error: any) {
        console.error('❌ Error syncing contests:', error.message);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            error: 'Failed to sync contests',
            details: error.message
        });
    }
});

// Get all contests from MongoDB
router.get('/', async (req, res) => {
    try {
        const { phase, limit = '100', offset = '0', search } = req.query;

        const query: any = {};
        if (phase) {
            query.phase = phase;
        }
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const contests = await Contest.find(query)
            .sort({ startTimeSeconds: -1 })
            .limit(parseInt(limit as string))
            .skip(parseInt(offset as string))
            .lean();

        const total = await Contest.countDocuments(query);

        res.json({
            success: true,
            count: contests.length,
            total,
            contests
        });
    } catch (error: any) {
        console.error('❌ Error fetching contests:', error.message);
        res.status(500).json({ error: 'Failed to fetch contests' });
    }
});

// Get contests organized by categories
router.get('/by-category', async (req, res) => {
    try {
        // Check MongoDB connection
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            console.error('❌ MongoDB not connected, state:', mongoose.connection?.readyState);
            return res.status(503).json({
                success: false,
                error: 'Database connection not available. Please try again in a moment.',
                dbState: mongoose.connection?.readyState
            });
        }

        const { limit = '50' } = req.query;
        const limitNum = parseInt(limit as string);

        console.log('📊 Fetching contests by category, limit:', limitNum);

        // Use aggregation pipeline for better performance
        const pipeline: any[] = [
            { $sort: { startTimeSeconds: -1 } },
            {
                $project: {
                    id: 1,
                    name: 1,
                    type: 1,
                    phase: 1,
                    startTimeSeconds: 1,
                    problemCount: { $size: { $ifNull: ['$problems', []] } }
                }
            }
        ];

        const allContests = await Contest.aggregate(pipeline).exec();

        console.log(`✅ Found ${allContests.length} total contests`);

        // Helper function to categorize contests
        const categorizeContest = (name: string) => {
            const lowerName = name.toLowerCase();

            // Check for Div. 1 + Div. 2
            if (lowerName.includes('div. 1') && lowerName.includes('div. 2')) {
                return 'DIV1_DIV2';
            }
            // Check for Div. 1
            if (lowerName.includes('div. 1') || lowerName.includes('div.1')) {
                return 'DIV1';
            }
            // Check for Div. 2
            if (lowerName.includes('div. 2') || lowerName.includes('div.2')) {
                return 'DIV2';
            }
            // Check for Div. 3
            if (lowerName.includes('div. 3') || lowerName.includes('div.3')) {
                return 'DIV3';
            }
            // Check for Div. 4
            if (lowerName.includes('div. 4') || lowerName.includes('div.4')) {
                return 'DIV4';
            }
            // Check for Global
            if (lowerName.includes('global')) {
                return 'GLOBAL';
            }
            // Check for Educational
            if (lowerName.includes('educational')) {
                return 'EDUCATIONAL';
            }

            return 'OTHERS';
        };

        // Organize contests by category
        const categories: Record<string, any[]> = {
            DIV1_DIV2: [],
            DIV1: [],
            DIV2: [],
            DIV3: [],
            DIV4: [],
            GLOBAL: [],
            EDUCATIONAL: [],
            OTHERS: []
        };

        allContests.forEach(contest => {
            const category = categorizeContest(contest.name);
            if (categories[category]) {
                categories[category]!.push({
                    id: contest.id,
                    name: contest.name,
                    type: contest.type,
                    phase: contest.phase,
                    startTimeSeconds: contest.startTimeSeconds,
                    problemCount: contest.problems?.length || 0,
                    date: contest.startTimeSeconds
                        ? new Date(contest.startTimeSeconds * 1000).toISOString()
                        : null
                });
            }
        });

        // Limit each category
        Object.keys(categories).forEach(key => {
            if (categories[key]) {
                categories[key] = categories[key]!.slice(0, limitNum);
            }
        });

        // Get counts
        const counts = {
            DIV1_DIV2: categories.DIV1_DIV2?.length || 0,
            DIV1: categories.DIV1?.length || 0,
            DIV2: categories.DIV2?.length || 0,
            DIV3: categories.DIV3?.length || 0,
            DIV4: categories.DIV4?.length || 0,
            GLOBAL: categories.GLOBAL?.length || 0,
            EDUCATIONAL: categories.EDUCATIONAL?.length || 0,
            OTHERS: categories.OTHERS?.length || 0,
            total: allContests.length
        };

        res.json({
            success: true,
            counts,
            categories
        });
    } catch (error: any) {
        console.error('❌ Error fetching contests by category:', error.message);
        res.status(500).json({ error: 'Failed to fetch contests by category' });
    }
});

// Refresh a specific contest from Codeforces API
router.post('/:id/refresh', async (req, res) => {
    try {
        const { id } = req.params;
        const contestId = parseInt(id);

        // Check MongoDB connection first
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            console.error('❌ MongoDB not connected, state:', mongoose.connection?.readyState);
            return res.status(503).json({
                success: false,
                error: 'Database connection not available',
                dbState: mongoose.connection?.readyState
            });
        }

        console.log(`🔄 Refreshing contest ${contestId} from Codeforces...`);

        // Step 1: Fetch the specific contest from Codeforces
        const contestsResponse = await axios.get<{ status: string; result: CFContest[] }>(
            'https://codeforces.com/api/contest.list',
            { timeout: 30000 }
        );

        if (contestsResponse.data.status !== 'OK') {
            return res.status(500).json({ error: 'Failed to fetch contests from Codeforces' });
        }

        const contest = contestsResponse.data.result.find(c => c.id === contestId);

        if (!contest) {
            return res.status(404).json({ error: 'Contest not found on Codeforces' });
        }

        // Step 2: Fetch problems for this contest using contest.standings API
        // This API has all problems immediately, unlike problemset.problems which may have delays
        const standingsResponse = await axios.get(
            `https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=1`,
            { timeout: 30000 }
        );

        const contestProblems: CFProblem[] = standingsResponse.data.status === 'OK' && standingsResponse.data.result.problems
            ? standingsResponse.data.result.problems.sort((a: CFProblem, b: CFProblem) => (a.index || '').localeCompare(b.index || ''))
            : [];

        // Step 3: Update or insert the contest with problems
        const contestData = {
            id: contest.id,
            name: contest.name,
            type: contest.type,
            phase: contest.phase,
            frozen: contest.frozen,
            durationSeconds: contest.durationSeconds,
            startTimeSeconds: contest.startTimeSeconds || 0,
            relativeTimeSeconds: contest.relativeTimeSeconds,
            problems: contestProblems.map(p => ({
                contestId: p.contestId,
                index: p.index,
                name: p.name,
                type: p.type,
                rating: p.rating,
                tags: p.tags || [],
                points: p.points
            })),
            preparedBy: contest.preparedBy,
            websiteUrl: contest.websiteUrl,
            description: contest.description,
            difficulty: contest.difficulty,
            kind: contest.kind,
            icpcRegion: contest.icpcRegion,
            country: contest.country,
            city: contest.city,
            season: contest.season,
            lastSynced: new Date()
        };

        const result = await Contest.findOneAndUpdate(
            { id: contestId },
            contestData,
            { upsert: true, new: true }
        );

        console.log(`✅ Refreshed contest ${contestId} with ${contestProblems.length} problems`);

        res.json({
            success: true,
            contest: result,
            problemsCount: contestProblems.length
        });
    } catch (error: any) {
        console.error(`❌ Error refreshing contest ${req.params.id}:`, error.message);
        res.status(500).json({ error: 'Failed to refresh contest', details: error.message });
    }
});

// Get single contest by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const contestId = parseInt(id);

        if (isNaN(contestId)) {
            return res.status(400).json({
                error: 'Invalid contest ID. Must be a number.'
            });
        }

        const contest = await Contest.findOne({ id: contestId }).lean();

        if (!contest) {
            return res.status(404).json({ error: 'Contest not found' });
        }

        res.json({
            success: true,
            contest
        });
    } catch (error: any) {
        console.error('❌ Error fetching contest:', error.message);
        res.status(500).json({ error: 'Failed to fetch contest' });
    }
});

// Get contests with problem count statistics
router.get('/stats/overview', async (req, res) => {
    try {
        const stats = await Contest.aggregate([
            {
                $project: {
                    id: 1,
                    name: 1,
                    phase: 1,
                    startTimeSeconds: 1,
                    durationSeconds: 1,
                    problemCount: { $size: '$problems' }
                }
            },
            { $sort: { startTimeSeconds: -1 } },
            { $limit: 100 }
        ]);

        res.json({
            success: true,
            stats
        });
    } catch (error: any) {
        console.error('❌ Error fetching contest stats:', error.message);
        res.status(500).json({ error: 'Failed to fetch contest stats' });
    }
});

// Check if database needs sync
router.get('/sync/status', async (req, res) => {
    try {
        const latestContest = await Contest.findOne()
            .sort({ lastSynced: -1 })
            .select('lastSynced')
            .lean();

        const contestCount = await Contest.countDocuments();

        const lastSync = latestContest?.lastSynced;
        const needsSync = !lastSync ||
            (Date.now() - new Date(lastSync).getTime() > CACHE_DURATION);

        res.json({
            success: true,
            lastSync: lastSync ? new Date(lastSync).toISOString() : null,
            contestCount,
            needsSync
        });
    } catch (error: any) {
        console.error('❌ Error checking sync status:', error.message);
        res.status(500).json({ error: 'Failed to check sync status' });
    }
});

// Informational GET for /sync: POST is required to trigger a sync.
router.get('/sync', (req, res) => {
    res.status(405).json({
        success: false,
        error: 'Method not allowed. Use POST /api/contests/sync to trigger an incremental sync. Use GET /api/contests/sync/status to check status.'
    });
});

// Get problems across all contests with filters
router.get('/problems/all', async (req, res) => {
    try {
        const { minRating, maxRating, tags, limit = '100' } = req.query;

        const pipeline: any[] = [
            { $unwind: '$problems' }
        ];

        // Build match conditions
        const matchConditions: any = {};

        if (minRating || maxRating) {
            matchConditions['problems.rating'] = {};
            if (minRating) matchConditions['problems.rating'].$gte = parseInt(minRating as string);
            if (maxRating) matchConditions['problems.rating'].$lte = parseInt(maxRating as string);
        }

        if (tags) {
            const tagArray = (tags as string).split(',');
            matchConditions['problems.tags'] = { $in: tagArray };
        }

        if (Object.keys(matchConditions).length > 0) {
            pipeline.push({ $match: matchConditions });
        }

        pipeline.push(
            { $limit: parseInt(limit as string) },
            {
                $project: {
                    _id: 0,
                    contestId: '$problems.contestId',
                    contestName: '$name',
                    index: '$problems.index',
                    name: '$problems.name',
                    rating: '$problems.rating',
                    tags: '$problems.tags',
                    type: '$problems.type'
                }
            }
        );

        const problems = await Contest.aggregate(pipeline);

        res.json({
            success: true,
            count: problems.length,
            problems
        });
    } catch (error: any) {
        console.error('❌ Error fetching problems:', error.message);
        res.status(500).json({ error: 'Failed to fetch problems' });
    }
});

export default router;
