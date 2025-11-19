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

// Top-level async initializer
(async () => {
    try {
        console.log("⏳ Connecting to MongoDB...");
        await connectDB(); // MUST finish before adding routes
        console.log("✅ MongoDB connected");

        // Now safe to load routes
        app.get('/', (req, res) => res.send('🔥 Backend is live'));
        app.use('/api/problems', problemRoutes);
        app.use('/api/contests', contestRoutes);

    } catch (err) {
        console.error("❌ MongoDB connection error:", err);
    }
})();

export default app; // Vercel picks this immediately
