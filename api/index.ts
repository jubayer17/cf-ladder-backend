import express from 'express';
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
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: false,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

app.use(express.json());

// Connect to MongoDB (async, won't block)
connectDB().catch(err => console.error('MongoDB connection failed:', err));

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

// API routes
app.use('/api/problems', problemRoutes);
app.use('/api/contests', contestRoutes);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

export default app;
