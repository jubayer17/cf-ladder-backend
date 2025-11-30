import 'dotenv/config';

process.on('uncaughtException', (err) => {
    try {
        console.error('UNCAUGHT EXCEPTION:');
        if (err && err.stack) console.error(err.stack);
        else console.error(err);
        if (err && typeof err === 'object' && !('stack' in err)) {
            try {
                console.error('Thrown object details:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
            } catch { }
        }
    } finally {
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
            } catch { }
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

connectDB()
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB error:", err));

app.use(cors({
    origin: ["https://cf-ladder-pro.vercel.app", "http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
}));
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
