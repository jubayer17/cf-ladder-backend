import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import problemRoutes from '../routes/problems.js';
import contestRoutes from '../routes/contests.js';

dotenv.config();

const app = express();

// Connect DB (must be outside handler)
connectDB()
    .then(() => console.log("✅ MongoDB connected (serverless)"))
    .catch((err) => console.log("❌ MongoDB error:", err));

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("🔥 Serverless API running on Vercel!");
});

app.use("/problems", problemRoutes);
app.use("/contests", contestRoutes);

export const handler = serverless(app);
export default handler;
