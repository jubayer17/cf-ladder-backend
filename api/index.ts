import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import problemRoutes from '../routes/problems.js';
import contestRoutes from '../routes/contests.js';

dotenv.config();

const app = express();

// Connect to MongoDB (outside handler)
connectDB()
    .then(() => console.log("✅ MongoDB connected (serverless)"))
    .catch((err) => console.log("❌ MongoDB error:", err));

app.use(cors());
app.use(express.json());

// Root route
app.get("/", (req, res) => {
    res.send("🔥 Serverless API running on Vercel!");
});

// Favicon route to prevent 404
app.get("/favicon.ico", (req, res) => res.status(204).end());

// API routes
app.use("/api/problems", problemRoutes);
app.use("/api/contests", contestRoutes);

export const handler = serverless(app);
export default handler;
