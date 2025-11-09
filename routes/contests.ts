import express from 'express';
import axios from 'axios';
import Contest from '../models/Contest.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();
const CACHE_FILE = path.join(process.cwd(), 'cache', 'contests.cache.json');
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

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
        console.log('🔄 Starting contest sync from Codeforces...');
        
        // Fetch contests from Codeforces
        const contestsResponse = await axios.get<{ status: string; result: CFContest[] }>(
            'https://codeforces.com/api/contest.list'
        );
        
        if (contestsResponse.data.status !== 'OK') {
            return res.status(500).json({ error: 'Failed to fetch contests from Codeforces' });
        }

        const contests: CFContest[] = contestsResponse.data.result;
        
        // Fetch all problems from Codeforces
        const problemsResponse = await axios.get<ProblemsetResponse>(
            'https://codeforces.com/api/problemset.problems'
        );
        
        const allProblems: CFProblem[] = problemsResponse.data.status === 'OK' 
            ? problemsResponse.data.result.problems 
            : [];

        // Group problems by contest ID
        const problemsByContest = new Map<number, CFProblem[]>();
        allProblems.forEach(problem => {
            if (problem.contestId) {
                if (!problemsByContest.has(problem.contestId)) {
                    problemsByContest.set(problem.contestId, []);
                }
                problemsByContest.get(problem.contestId)!.push(problem);
            }
        });

        let contestsInserted = 0;
        let contestsUpdated = 0;

        // Insert or update contests with their problems
        for (const contest of contests) {
            const contestProblems = problemsByContest.get(contest.id) || [];
            
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

            const existing = await Contest.findOne({ id: contest.id });
            if (existing) {
                await Contest.updateOne({ id: contest.id }, contestData);
                contestsUpdated++;
            } else {
                await Contest.create(contestData);
                contestsInserted++;
            }
        }

        // Save to cache file
        await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
        await fs.writeFile(CACHE_FILE, JSON.stringify({
            contests,
            problems: allProblems,
            lastSync: Math.floor(Date.now() / 1000),
            timestamp: Date.now()
        }));

        console.log(`✅ Synced ${contestsInserted} new contests and updated ${contestsUpdated} contests`);

        res.json({
            success: true,
            contestsInserted,
            contestsUpdated,
            totalProblems: allProblems.length
        });
    } catch (error: any) {
        console.error('❌ Error syncing contests:', error.message);
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

// Get single contest by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const contest = await Contest.findOne({ id: parseInt(id) }).lean();
        
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
