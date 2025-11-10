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
app.use(cors());
app.use(express.json());

// Root route
app.get('/', (req, res) => {
    res.send('✅ Server is running successfully!');
});

// API routes
app.use('/api/problems', problemRoutes);
app.use('/api/contests', contestRoutes);

export default app;
