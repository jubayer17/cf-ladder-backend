import 'dotenv/config'; // MUST BE FIRST for ts-node + ESM

// Global handlers to capture thrown non-Error objects and unhandled rejections
process.on('uncaughtException', (err) => {
    try {
        console.error('UNCAUGHT EXCEPTION:');
        if (err && err.stack) console.error(err.stack);
        else console.error(err);
        if (err && typeof err === 'object' && !('stack' in err)) {
            try {
                console.error('Thrown object details:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
            } catch {}
        }
    } finally {
        // exit so nodemon or the caller can restart and we don't continue in a bad state
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason) => {
    try {
        console.error('UNHANDLED REJECTION:');
        if (reason && (reason as any).stack) console.error((reason as any).stack);
        else console.error(reason);
        if (reason && typeof reason === 'object' && !('stack' in reason)) {
            try {
                console.error('Rejection object details:', JSON.stringify(reason, Object.getOwnPropertyNames(reason), 2));
            } catch {}
        }
    } finally {
        process.exit(1);
    }
});

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
