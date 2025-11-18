import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import problemRoutes from './routes/problems.js';
import contestRoutes from './routes/contests.js';

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB()
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Middlewares
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Root route
app.get('/', (req, res) => {
    res.send('🚀 Local server is running perfectly!');
});

// Routes
app.use('/api/problems', problemRoutes);
app.use('/api/contests', contestRoutes);

// Start server locally
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🔥 Server is live at http://localhost:${PORT}`);
});
