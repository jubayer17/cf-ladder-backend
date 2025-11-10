import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import problemRoutes from '../routes/problems.js';
import contestRoutes from '../routes/contests.js';

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

export default app;
