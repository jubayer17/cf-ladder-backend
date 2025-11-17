import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import problemRoutes from './routes/problems.js';
import contestRoutes from './routes/contests.js';

dotenv.config();
connectDB().catch(err => console.error('❌ MongoDB connection failed:', err));

const app = express();

// CORS & JSON
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Root route
app.get('/', (req, res) => res.send('✅ Server is running successfully!'));

// API routes
app.use('/api/problems', problemRoutes);
app.use('/api/contests', contestRoutes);

// Export as serverless handler
export const handler = serverless(app);
