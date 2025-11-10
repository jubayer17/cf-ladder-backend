import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import problemRoutes from './routes/problems.js';
import contestRoutes from './routes/contests.js';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Enable CORS for all origins
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// 👇 Root route (just to confirm server is working)
app.get('/', (req, res) => {
    res.send('✅ Server is running successfully!');
});

// 👇 API routes (path only, no domain!)
app.use('/api/problems', problemRoutes);
app.use('/api/contests', contestRoutes);

const PORT = process.env.PORT || 4000;

// For local development
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
}

// Export for Vercel
export default app;
