"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const database_js_1 = __importDefault(require("../config/database.js"));
const mongoose_1 = __importDefault(require("mongoose"));
const problems_js_1 = __importDefault(require("../routes/problems.js"));
const contests_js_1 = __importDefault(require("../routes/contests.js"));
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// MongoDB connection handling
const MONGO_URI = process.env.MONGODB_URI;
const mongoUriMissing = !MONGO_URI;
if (mongoUriMissing) {
    console.warn('⚠️ MONGODB_URI is not set. Backend will run but DB routes will return a clear error.');
}
else {
    // Start connection eagerly
    (0, database_js_1.default)()
        .then(() => console.log('✅ MongoDB connected'))
        .catch(err => console.error('❌ MongoDB connection error:', err));
}
// Ensure DB is connected before handling requests. If MONGO_URI is missing, return
// a helpful error telling the deployer to set the variable in Vercel.
app.use(async (req, res, next) => {
    if (mongoUriMissing) {
        return res.status(503).json({
            success: false,
            error: 'Database connection not available',
            details: 'MONGODB_URI environment variable is not set. Set it in your Vercel project settings and redeploy.'
        });
    }
    try {
        if (!mongoose_1.default.connection || mongoose_1.default.connection.readyState !== 1) {
            await (0, database_js_1.default)();
        }
        return next();
    }
    catch (err) {
        console.error('❌ DB connection unavailable in middleware:', err?.message || err);
        return res.status(503).json({ success: false, error: 'Database connection not available', details: err?.message || null });
    }
});
// Routes
app.get('/', (req, res) => res.send('🔥 Backend is live'));
app.use('/api/problems', problems_js_1.default);
app.use('/api/contests', contests_js_1.default);
exports.default = app; // Vercel handles listen
//# sourceMappingURL=index.js.map