import express from 'express';
import type { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
    try {
        const response = await axios.get('https://codeforces.com/api/problemset.problems');
        const problems = response.data.result.problems;

        const minRating = Number(req.query.minRating) || 800;
        const maxRating = Number(req.query.maxRating) || 1200;

        const filtered = problems.filter((p: any) => p.rating && p.rating >= minRating && p.rating <= maxRating);

        res.json({ problems: filtered });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching problems' });
    }
});

export default router;
