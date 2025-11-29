import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from '../config/database.js';
import mongoose from 'mongoose';
import problemRoutes from '../routes/problems.js';
import contestRoutes from '../routes/contests.js';

const app = express();

// Middleware
app.use(cors({
    origin: ["https://cf-ladder-pro.vercel.app", "http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
}));
app.use(express.json());

// MongoDB connection handling
const MONGO_URI = process.env.MONGODB_URI;
const mongoUriMissing = !MONGO_URI;

if (mongoUriMissing) {
    console.warn('⚠️ MONGODB_URI is not set. Backend will run but DB routes will return a clear error.');
} else {
    // Start connection eagerly
    connectDB()
        .then(() => console.log('✅ MongoDB connected'))
        .catch(err => console.error('❌ MongoDB connection error:', err));
}

// Ensure DB is connected before handling requests. If MONGO_URI is missing, return
// a helpful error telling the deployer to set the variable in Vercel.
app.use(async (req, res, next) => {
    if (mongoUriMissing) {
        return res.status(503).json({
            success: false,
            error: 'Database connection not available',
            details: 'MONGODB_URI environment variable is not set. Set it in your Vercel project settings and redeploy.'
        });
    }

    try {
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            await connectDB();
        }
        return next();
    } catch (err: any) {
        console.error('❌ DB connection unavailable in middleware:', err?.message || err);
        return res.status(503).json({ success: false, error: 'Database connection not available', details: err?.message || null });
    }
});

// Routes
app.get('/', (req, res) => res.send('🔥 Backend is live'));
app.use('/api/problems', problemRoutes);
app.use('/api/contests', contestRoutes);

export default app; // Vercel handles listen
