"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const mongoose_1 = __importDefault(require("mongoose"));
const Contest_js_1 = __importDefault(require("../models/Contest.js"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const p_limit_1 = __importDefault(require("p-limit"));
const router = express_1.default.Router();
const limit = (0, p_limit_1.default)(5);
const CACHE_FILE = path_1.default.join(process.cwd(), 'cache', 'contests.cache.json');
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
const problemsByContest = new Map();
// Sync contests from Codeforces API to MongoDB
router.post('/sync', async (req, res) => {
    try {
        // Check MongoDB connection first
        if (!mongoose_1.default.connection || mongoose_1.default.connection.readyState !== 1) {
            console.error('❌ MongoDB not connected, state:', mongoose_1.default.connection?.readyState);
            return res.status(503).json({
                success: false,
                error: 'Database connection not available',
                dbState: mongoose_1.default.connection?.readyState
            });
        }
        console.log('🔄 Starting robust contest sync from Codeforces...');
        // Step 1: Get ALL existing contest IDs from DB
        const existingContests = await Contest_js_1.default.find().select('id').lean();
        const existingIds = new Set(existingContests.map(c => c.id));
        console.log(`📊 Found ${existingIds.size} existing contests in DB`);
        // Step 2: Fetch FULL contest list from Codeforces
        console.log('📥 Querying Codeforces contest.list...');
        const listResp = await axios_1.default.get('https://codeforces.com/api/contest.list', { timeout: 30000 });
        if (!listResp.data || listResp.data.status !== 'OK' || !Array.isArray(listResp.data.result)) {
            throw new Error('Failed to fetch contest list from Codeforces');
        }
        const allContests = listResp.data.result;
        console.log(`📊 Codeforces returned ${allContests.length} contests`);
        // Step 3: Identify missing FINISHED contests
        // We want contests that are:
        // 1. FINISHED
        // 2. NOT in our DB
        // 3. Have a valid startTimeSeconds
        const missingContests = allContests.filter(c => {
            return (c.phase === 'FINISHED') &&
                !existingIds.has(c.id) &&
                typeof c.startTimeSeconds === 'number';
        });
        console.log(`🔎 Found ${missingContests.length} missing finished contests`);
        if (missingContests.length === 0) {
            console.log('✅ Already up to date - no missing contests found');
            return res.json({
                success: true,
                contestsInserted: 0,
                contestsUpdated: 0,
                totalProblems: 0,
                message: 'Already up to date'
            });
        }
        // Sort by startTime ascending to insert oldest first
        missingContests.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
        // Limit to avoid hitting API limits too hard in one go (e.g., 50 at a time)
        // If there are many missing, the user can click update again
        const BATCH_LIMIT = 50;
        const toProcess = missingContests.slice(0, BATCH_LIMIT);
        console.log(`Processing first ${toProcess.length} missing contests...`);
        const discoveredContests = [];
        const discoveredProblems = new Map();
        // Step 4: Fetch details (problems) for missing contests
        const tasks = toProcess.map((c) => limit(async () => {
            const cid = c.id;
            try {
                // We use contest.standings to get problems
                const standingsResp = await axios_1.default.get(`https://codeforces.com/api/contest.standings?contestId=${cid}&from=1&count=1`, { timeout: 20000 });
                if (standingsResp.data.status !== 'OK') {
                    throw new Error(`Codeforces API error: ${standingsResp.data.comment}`);
                }
                const problemsRaw = Array.isArray(standingsResp.data.result?.problems) ? standingsResp.data.result.problems : [];
                const problemsArr = problemsRaw.map((p) => ({
                    contestId: cid,
                    index: p.index,
                    name: p.name,
                    type: p.type || 'PROGRAMMING',
                    rating: p.rating,
                    tags: p.tags || [],
                    points: p.points
                }));
                const contestObj = {
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
                discoveredContests.push(contestObj);
                discoveredProblems.set(cid, problemsArr);
                console.log(`  → Fetched contest ${cid} (${contestObj.name}) with ${problemsArr.length} problems`);
            }
            catch (e) {
                console.warn(`  × Failed to fetch problems for contest ${cid}:`, e?.message || e);
            }
        }));
        await Promise.all(tasks);
        // Step 5: Insert into DB
        let contestsInserted = 0;
        const contestsToInsert = [];
        for (const contest of discoveredContests) {
            const contestProblems = discoveredProblems.get(contest.id) || [];
            // Sort problems by index
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
            contestsToInsert.push(contestData);
        }
        if (contestsToInsert.length > 0) {
            // Use insertMany with ordered: false to continue even if duplicates found (though we filtered them)
            try {
                await Contest_js_1.default.insertMany(contestsToInsert, { ordered: false });
                contestsInserted = contestsToInsert.length;
            }
            catch (e) {
                // If some failed (e.g. race condition), just log and continue
                console.warn('Partial insertion error (likely duplicates):', e.message);
                contestsInserted = e.insertedDocs?.length || 0;
            }
        }
        // Update cache file
        try {
            await promises_1.default.mkdir(path_1.default.dirname(CACHE_FILE), { recursive: true });
            // We just update the timestamp, full cache rebuild might be too heavy here
            // or we could append. For now, let's just ensure the dir exists.
        }
        catch (e) { }
        console.log(`✅ Synced ${contestsInserted} new contests`);
        res.json({
            success: true,
            contestsInserted,
            contestsUpdated: 0,
            totalProblems: Array.from(discoveredProblems.values()).flat().length,
            newContestsCount: discoveredContests.length,
            remainingMissing: Math.max(0, missingContests.length - BATCH_LIMIT)
        });
    }
    catch (error) {
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
        const query = {};
        if (phase) {
            query.phase = phase;
        }
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }
        const contests = await Contest_js_1.default.find(query)
            .sort({ startTimeSeconds: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .lean();
        const total = await Contest_js_1.default.countDocuments(query);
        res.json({
            success: true,
            count: contests.length,
            total,
            contests
        });
    }
    catch (error) {
        console.error('❌ Error fetching contests:', error.message);
        res.status(500).json({ error: 'Failed to fetch contests' });
    }
});
// Get contests organized by categories
router.get('/by-category', async (req, res) => {
    try {
        // Check MongoDB connection
        if (!mongoose_1.default.connection || mongoose_1.default.connection.readyState !== 1) {
            console.error('❌ MongoDB not connected, state:', mongoose_1.default.connection?.readyState);
            return res.status(503).json({
                success: false,
                error: 'Database connection not available. Please try again in a moment.',
                dbState: mongoose_1.default.connection?.readyState
            });
        }
        const { limit = '50' } = req.query;
        const limitNum = parseInt(limit);
        console.log('📊 Fetching contests by category, limit:', limitNum);
        // Use aggregation pipeline for better performance
        const pipeline = [
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
        const allContests = await Contest_js_1.default.aggregate(pipeline).exec();
        console.log(`✅ Found ${allContests.length} total contests`);
        // Helper function to categorize contests
        const categorizeContest = (name) => {
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
        const categories = {
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
                categories[category].push({
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
                categories[key] = categories[key].slice(0, limitNum);
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
    }
    catch (error) {
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
        if (!mongoose_1.default.connection || mongoose_1.default.connection.readyState !== 1) {
            console.error('❌ MongoDB not connected, state:', mongoose_1.default.connection?.readyState);
            return res.status(503).json({
                success: false,
                error: 'Database connection not available',
                dbState: mongoose_1.default.connection?.readyState
            });
        }
        console.log(`🔄 Refreshing contest ${contestId} from Codeforces...`);
        // Step 1: Fetch the specific contest from Codeforces
        const contestsResponse = await axios_1.default.get('https://codeforces.com/api/contest.list', { timeout: 30000 });
        if (contestsResponse.data.status !== 'OK') {
            return res.status(500).json({ error: 'Failed to fetch contests from Codeforces' });
        }
        const contest = contestsResponse.data.result.find(c => c.id === contestId);
        if (!contest) {
            return res.status(404).json({ error: 'Contest not found on Codeforces' });
        }
        // Step 2: Fetch problems for this contest using contest.standings API
        // This API has all problems immediately, unlike problemset.problems which may have delays
        const standingsResponse = await axios_1.default.get(`https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=1`, { timeout: 30000 });
        const contestProblems = standingsResponse.data.status === 'OK' && standingsResponse.data.result.problems
            ? standingsResponse.data.result.problems.sort((a, b) => (a.index || '').localeCompare(b.index || ''))
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
        const result = await Contest_js_1.default.findOneAndUpdate({ id: contestId }, contestData, { upsert: true, new: true });
        console.log(`✅ Refreshed contest ${contestId} with ${contestProblems.length} problems`);
        res.json({
            success: true,
            contest: result,
            problemsCount: contestProblems.length
        });
    }
    catch (error) {
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
        const contest = await Contest_js_1.default.findOne({ id: contestId }).lean();
        if (!contest) {
            return res.status(404).json({ error: 'Contest not found' });
        }
        res.json({
            success: true,
            contest
        });
    }
    catch (error) {
        console.error('❌ Error fetching contest:', error.message);
        res.status(500).json({ error: 'Failed to fetch contest' });
    }
});
// Get contests with problem count statistics
router.get('/stats/overview', async (req, res) => {
    try {
        const stats = await Contest_js_1.default.aggregate([
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
    }
    catch (error) {
        console.error('❌ Error fetching contest stats:', error.message);
        res.status(500).json({ error: 'Failed to fetch contest stats' });
    }
});
// Check if database needs sync
router.get('/sync/status', async (req, res) => {
    try {
        const latestContest = await Contest_js_1.default.findOne()
            .sort({ lastSynced: -1 })
            .select('lastSynced')
            .lean();
        const contestCount = await Contest_js_1.default.countDocuments();
        const lastSync = latestContest?.lastSynced;
        const needsSync = !lastSync ||
            (Date.now() - new Date(lastSync).getTime() > CACHE_DURATION);
        res.json({
            success: true,
            lastSync: lastSync ? new Date(lastSync).toISOString() : null,
            contestCount,
            needsSync
        });
    }
    catch (error) {
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
        const pipeline = [
            { $unwind: '$problems' }
        ];
        // Build match conditions
        const matchConditions = {};
        if (minRating || maxRating) {
            matchConditions['problems.rating'] = {};
            if (minRating)
                matchConditions['problems.rating'].$gte = parseInt(minRating);
            if (maxRating)
                matchConditions['problems.rating'].$lte = parseInt(maxRating);
        }
        if (tags) {
            const tagArray = tags.split(',');
            matchConditions['problems.tags'] = { $in: tagArray };
        }
        if (Object.keys(matchConditions).length > 0) {
            pipeline.push({ $match: matchConditions });
        }
        pipeline.push({ $limit: parseInt(limit) }, {
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
        });
        const problems = await Contest_js_1.default.aggregate(pipeline);
        res.json({
            success: true,
            count: problems.length,
            problems
        });
    }
    catch (error) {
        console.error('❌ Error fetching problems:', error.message);
        res.status(500).json({ error: 'Failed to fetch problems' });
    }
});
exports.default = router;
//# sourceMappingURL=contests.js.map