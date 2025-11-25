"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const mongoose_1 = __importDefault(require("mongoose"));
const database_js_1 = __importDefault(require("../config/database.js")); // your DB connect function
async function handler(req, res) {
    try {
        await (0, database_js_1.default)(); // ensure DB is connected
        const mongoStatus = mongoose_1.default.connection.readyState;
        const statusMap = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            mongodb: statusMap[mongoStatus] || 'unknown',
            env: {
                hasMongoUri: !!process.env.MONGODB_URI,
                nodeEnv: process.env.NODE_ENV
            }
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
}
//# sourceMappingURL=health.js.map