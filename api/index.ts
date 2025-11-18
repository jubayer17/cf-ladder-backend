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

// MongoDB connection
connectDB()
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.get('/', (req, res) => res.send('🔥 Backend is live'));
app.use('/api/problems', problemRoutes);
app.use('/api/contests', contestRoutes);

export default app; // Vercel handles listen
