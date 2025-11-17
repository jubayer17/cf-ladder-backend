import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import problemRoutes from './routes/problems.js';
import contestRoutes from './routes/contests.js';

dotenv.config();

// Connect to MongoDB (use try/catch to avoid crashing)
connectDB().catch(err => console.error('❌ MongoDB connection failed:', err));

const app = express();

// CORS & JSON
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Root route
app.get('/', (req, res) => res.send('✅ Server is running successfully fuckk!'));

// API routes
app.use('/api/problems', problemRoutes);
app.use('/api/contests', contestRoutes);

// ✅ Vercel requires a default export for serverless functions
export default serverless(app);
