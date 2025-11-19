import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from '../config/database.js';
import problemRoutes from '../routes/problems.js';
import contestRoutes from '../routes/contests.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection: don't block module import — ensure connections before handling requests
// We'll still call connectDB() eagerly to start connection, but also add a middleware
// that will await the connection for incoming requests to avoid mongoose buffer errors.
connectDB()
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Ensure DB is connected before handling requests. This middleware will await
// the shared `connectDB()` promise if the connection isn't ready yet.
app.use(async (req, res, next) => {
    try {
        if (!require('mongoose').connection || require('mongoose').connection.readyState !== 1) {
            await connectDB();
        }
        return next();
    } catch (err: any) {
        console.error('❌ DB connection unavailable in middleware:', err?.message || err);
        return res.status(503).json({ success: false, error: 'Database connection not available' });
    }
});

// Routes
app.get('/', (req, res) => res.send('🔥 Backend is live'));
app.use('/api/problems', problemRoutes);
app.use('/api/contests', contestRoutes);

export default app; // Vercel handles listen
