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

// Wrap everything in an async initializer
async function init() {
    try {
        console.log("⏳ Connecting to MongoDB...");
        await connectDB(); // 🔥 THIS is the fix
        console.log("✅ MongoDB connected");

        // 🔥 Load routes ONLY AFTER DB is connected
        app.get('/', (req, res) => res.send('🔥 Backend is live'));
        app.use('/api/problems', problemRoutes);
        app.use('/api/contests', contestRoutes);

    } catch (err) {
        console.error("❌ MongoDB connection error:", err);
    }
}

// IMPORTANT: run initializer immediately
init();

export default app; // Vercel handles listen
