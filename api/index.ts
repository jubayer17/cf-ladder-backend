import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import connectDB from '../config/database.js';
import problemRoutes from '../routes/problems.js';
import contestRoutes from '../routes/contests.js';

dotenv.config();

const app = express();

// CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control', 'Pragma', 'Expires', 'X-Requested-With'],
    credentials: false
}));

app.options('*', cors());
app.use(express.json());

// Start DB connection once
let dbConnectionPromise: Promise<void> | null = null;

const initDB = async () => {
    if (!dbConnectionPromise) {
        dbConnectionPromise = connectDB();
    }
    return dbConnectionPromise;
};

initDB().catch(err => {
    console.error('❌ Initial MongoDB connect failed:', err.message);
});

// Middleware: ensure DB connected
const ensureDBConnection = async (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/api/health' || req.path === '/' || req.path === '/api') {
        return next();
    }

    try {
        const CONNECTED = 1;

        if (mongoose.connection.readyState !== CONNECTED) {
            await initDB();
        }

        if (mongoose.connection.readyState !== CONNECTED) {
            return res.status(503).json({
                success: false,
                error: 'Database unavailable.'
            });
        }

        next();
    } catch (error: any) {
        console.error('❌ DB middleware:', error.message);
        res.status(503).json({ success: false, error: error.message });
    }
};

// Health route
app.get('/api/health', (req, res) => {
    const state = mongoose.connection.readyState;
    const status = ['disconnected', 'connected', 'connecting', 'disconnecting'];

    res.json({
        status: 'ok',
        mongodb: status[state] || 'unknown',
        timestamp: new Date().toISOString()
    });
});

// Root route
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Server running' });
});

app.get('/api', (req, res) => {
    res.json({ status: 'ok', message: 'API running' });
});

// Routes
app.use('/api/problems', ensureDBConnection, problemRoutes);
