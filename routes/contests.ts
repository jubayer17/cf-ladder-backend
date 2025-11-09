import express from 'express';
import axios from 'axios';
import { openDB } from '../utils/db.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();
const CACHE_FILE = path.join(process.cwd(), 'cache', 'contests.cache.json');
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

interface Contest {
    id: number;
    name: string;
    type?: string;
    phase?: string;
    frozen?: boolean;
    durationSeconds?: number;
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

interface ContestProblem {
    contestId: number;
    index: string;
    name: string;
    type?: string;
    points?: number;
    rating?: number;
    tags?: string[];
}

// Sync contests from Codeforces API to database
router.post('/sync', async (req, res) => {
    try {
        console.log('🔄 Starting contest sync from Codeforces...');
        
        // Fetch contests from Codeforces
        const contestsResponse = await axios.get('https://codeforces.com/api/contest.list');
        
        if (contestsResponse.data.status !== 'OK') {
            return res.status(500).json({ error: 'Failed to fetch contests from Codeforces' });
        }

        const contests: Contest[] = contestsResponse.data.result;
        
        // Fetch problems to associate with contests
        const problemsResponse = await axios.get('https://codeforces.com/api/problemset.problems');
        const problems: ContestProblem[] = problemsResponse.data.status === 'OK' 
            ? problemsResponse.data.result.problems 
            : [];

        const db = await openDB();
        const syncTime = Math.floor(Date.now() / 1000);

        // Begin transaction
        await db.run('BEGIN TRANSACTION');

        try {
            let contestsInserted = 0;
            let problemsInserted = 0;

            // Insert or update contests
            for (const contest of contests) {
                await db.run(`
                    INSERT OR REPLACE INTO contests (
                        id, name, type, phase, frozen, duration_seconds, 
                        start_time_seconds, relative_time_seconds, prepared_by,
                        website_url, description, difficulty, kind, icpc_region,
                        country, city, season, synced_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    contest.id,
                    contest.name,
                    contest.type || null,
                    contest.phase || null,
                    contest.frozen ? 1 : 0,
                    contest.durationSeconds || null,
                    contest.startTimeSeconds || null,
                    contest.relativeTimeSeconds || null,
                    contest.preparedBy || null,
                    contest.websiteUrl || null,
                    contest.description || null,
                    contest.difficulty || null,
                    contest.kind || null,
                    contest.icpcRegion || null,
                    contest.country || null,
                    contest.city || null,
                    contest.season || null,
                    syncTime
                ]);
                contestsInserted++;
            }

            // Insert problems
            for (const problem of problems) {
                if (problem.contestId && problem.index) {
                    await db.run(`
                        INSERT OR REPLACE INTO problems (
                            contest_id, index_name, name, type, points, rating, tags
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        problem.contestId,
                        problem.index,
                        problem.name,
                        problem.type || null,
                        problem.points || null,
                        problem.rating || null,
                        problem.tags ? JSON.stringify(problem.tags) : null
                    ]);
                    problemsInserted++;
                }
            }

            await db.run('COMMIT');

            // Save to cache file
            await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
            await fs.writeFile(CACHE_FILE, JSON.stringify({
                contests,
                problems,
                lastSync: syncTime,
                timestamp: Date.now()
            }));

            console.log(`✅ Synced ${contestsInserted} contests and ${problemsInserted} problems`);

            res.json({
                success: true,
                contestsInserted,
                problemsInserted,
                syncTime
            });
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    } catch (error: any) {
        console.error('❌ Error syncing contests:', error.message);
        res.status(500).json({ 
            error: 'Failed to sync contests', 
            details: error.message 
        });
    }
});

// Get all contests from database
router.get('/', async (req, res) => {
    try {
        const { phase, limit, offset } = req.query;
        
        const db = await openDB();
        let query = 'SELECT * FROM contests';
        const params: any[] = [];

        if (phase) {
            query += ' WHERE phase = ?';
            params.push(phase);
        }

        query += ' ORDER BY start_time_seconds DESC';

        if (limit) {
            query += ' LIMIT ?';
            params.push(parseInt(limit as string));
        }

        if (offset) {
            query += ' OFFSET ?';
            params.push(parseInt(offset as string));
        }

        const contests = await db.all(query, params);

        res.json({
            success: true,
            count: contests.length,
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
        const db = await openDB();

        const contest = await db.get('SELECT * FROM contests WHERE id = ?', [id]);
        
        if (!contest) {
            return res.status(404).json({ error: 'Contest not found' });
        }

        // Get problems for this contest
        const problems = await db.all(
            'SELECT * FROM problems WHERE contest_id = ? ORDER BY index_name',
            [id]
        );

        // Parse tags JSON for each problem
        const problemsWithTags = problems.map(p => ({
            ...p,
            tags: p.tags ? JSON.parse(p.tags) : []
        }));

        res.json({
            success: true,
            contest,
            problems: problemsWithTags
        });
    } catch (error: any) {
        console.error('❌ Error fetching contest:', error.message);
        res.status(500).json({ error: 'Failed to fetch contest' });
    }
});

// Get contests with problem count
router.get('/stats/overview', async (req, res) => {
    try {
        const db = await openDB();

        const stats = await db.all(`
            SELECT 
                c.*,
                COUNT(p.id) as problem_count
            FROM contests c
            LEFT JOIN problems p ON c.id = p.contest_id
            GROUP BY c.id
            ORDER BY c.start_time_seconds DESC
            LIMIT 100
        `);

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
        const db = await openDB();
        
        const result = await db.get('SELECT MAX(synced_at) as last_sync FROM contests');
        const contestCount = await db.get('SELECT COUNT(*) as count FROM contests');
        
        const needsSync = !result?.last_sync || 
            (Date.now() / 1000 - result.last_sync > CACHE_DURATION / 1000);

        res.json({
            success: true,
            lastSync: result?.last_sync || null,
            contestCount: contestCount?.count || 0,
            needsSync
        });
    } catch (error: any) {
        console.error('❌ Error checking sync status:', error.message);
        res.status(500).json({ error: 'Failed to check sync status' });
    }
});

export default router;
