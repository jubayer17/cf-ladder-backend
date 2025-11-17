import serverless from 'serverless-http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';
import problemRoutes from '../routes/problems.js';
import contestRoutes from '../routes/contests.js';

dotenv.config();

const app = express();

// CORS & JSON
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());

// MongoDB connection caching
let dbConnectionPromise: Promise<void> | null = null;
const initDB = async () => {
    if (!dbConnectionPromise) dbConnectionPromise = connectDB();
    return dbConnectionPromise;
};
initDB().catch(err => console.error('❌ Initial MongoDB connect failed:', err.message));

// Middleware to ensure DB is connected before using API routes
const ensureDBConnection = async (req: Request, res: Response, next: NextFunction) => {
    if (['/api/health', '/', '/api'].includes(req.path)) return next();
    if (mongoose.connection.readyState !== 1) await initDB();
    if (mongoose.connection.readyState !== 1)
        return res.status(503).json({ success: false, error: 'Database unavailable.' });
    next();
};

// Health & root routes
app.get('/api/health', (req, res) => {
    const state = mongoose.connection.readyState;
    const status = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.json({
        status: 'ok',
        mongodb: status[state] || 'unknown',
        timestamp: new Date().toISOString(),
        env: {
            hasMongoUri: !!process.env.MONGODB_URI,
            nodeEnv: process.env.NODE_ENV
        }
    });
});
app.get('/', (req, res) => res.json({ status: 'ok', message: 'Server running' }));
app.get('/api', (req, res) => res.json({ status: 'ok', message: 'API running' }));

// API routes with DB check
app.use('/api/problems', ensureDBConnection, problemRoutes);
app.use('/api/contests', ensureDBConnection, contestRoutes);

// ✅ Default export for Vercel
export default serverless(app);
