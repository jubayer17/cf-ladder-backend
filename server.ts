import 'dotenv/config'; // MUST BE FIRST for ts-node + ESM

import express from 'express';
import cors from 'cors';
import connectDB from './config/database.js';
import problemRoutes from './routes/problems.js';
import contestRoutes from './routes/contests.js';

const app = express();

// DB connect
connectDB()
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB error:", err));

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("🔥 Local server is running perfectly!");
});

app.use("/api/problems", problemRoutes);
app.use("/api/contests", contestRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Local server live at http://localhost:${PORT}`);
});
