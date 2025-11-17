import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';
import problemRoutes from '../routes/problems.js';
import contestRoutes from '../routes/contests.js';

dotenv.config();

const app = express();

// Enable CORS for all origins with preflight
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control', 'Pragma', 'Expires'],
    credentials: false,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

app.use(express.json());

// Initialize MongoDB connection (don't wait for it to block startup)
let dbConnectionPromise: Promise<void> | null = null;

const initDB = async () => {
    if (!dbConnectionPromise) {
        dbConnectionPromise = connectDB();
    }
    return dbConnectionPromise;
};

// Start connection immediately
initDB().catch(err => {
    console.error('❌ Initial MongoDB connection failed:', err.message);
});

// Middleware to ensure DB is connected before processing requests
const ensureDBConnection = async (req: Request, res: Response, next: NextFunction) => {
    // Skip DB check for health endpoint
    if (req.path === '/api/health' || req.path === '/' || req.path === '/api') {
        return next();
    }

    try {
        const CONNECTED = 1; // mongoose.connection.readyState === 1 means connected

        // Try to connect if not already connected
        if ((mongoose.connection.readyState as number) !== CONNECTED) {
            console.log('⏳ Waiting for MongoDB connection...');
            await initDB();

            // Wait a bit more if still connecting
            let retries = 0;
            const maxRetries = 5;
            while ((mongoose.connection.readyState as number) !== CONNECTED && retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 500));
                retries++;
            }
        }

        if ((mongoose.connection.readyState as number) !== CONNECTED) {
            return res.status(503).json({
                success: false,
                error: 'Database connection not available. Please try again in a moment.',
                dbState: mongoose.connection.readyState
            });
        }

        next();
    } catch (error: any) {
        console.error('❌ DB connection middleware error:', error.message);
        res.status(503).json({
            success: false,
            error: 'Database connection failed',
            message: error.message
        });
    }
};

// Health check endpoint with detailed diagnostics
app.get('/api/health', (req, res) => {
    const mongoStatus = mongoose.connection.readyState;
    const statusMap: Record<number, string> = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };

    res.json({
        status: 'ok',
        mongodb: statusMap[mongoStatus] || 'unknown',
        env: {
            hasMongoUri: !!process.env.MONGODB_URI,
            nodeEnv: process.env.NODE_ENV
        },
        timestamp: new Date().toISOString()
    });
});

// Root route
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: '✅ Server is running successfully!' });
});

app.get('/api', (req, res) => {
    res.json({ status: 'ok', message: '✅ API is running!' });
});

// Apply DB connection middleware to API routes
app.use('/api/problems', ensureDBConnection, problemRoutes);
app.use('/api/contests', ensureDBConnection, contestRoutes);

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('❌ Error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

export default app;
