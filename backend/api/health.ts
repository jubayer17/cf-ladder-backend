import type { Request, Response } from 'express';
import mongoose from 'mongoose';

export default async function handler(req: Request, res: Response) {
    try {
        const mongoStatus = mongoose.connection.readyState;
        const statusMap: Record<number, string> = {
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
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
}
