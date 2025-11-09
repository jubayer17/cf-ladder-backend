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
app.use(cors()); // ✅ Allow cross-origin requests
app.use(express.json());

// 👇 Root route (just to confirm server is working)
app.get('/', (req, res) => {
    res.send('✅ Server is running successfully!');
});

// 👇 API routes (path only, no domain!)
app.use('/api/problems', problemRoutes);
app.use('/api/contests', contestRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
